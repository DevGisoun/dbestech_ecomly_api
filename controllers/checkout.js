const jwt = require("jsonwebtoken");
const { User } = require("../models/user");
const { Product } = require("../models/product");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const orderController = require('./orders');
const emailSender = require('../helpers/email_sender');
const mailBuilder = require('../helpers/order_complete_email_builder');

exports.checkout = async (req, res) => {
    try {
        const accessToken = req.header('Authorization').replace('Bearer', '').trim();
        const tokenData = jwt.decode(accessToken);

        const user = await User.findById(tokenData.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        for (const cartItem of req.body.cartItems) {
            const product = await Product.findById(cartItem.product);
            if (!product) {
                return res.status(404).json({ message: `${cartItem.name} not found.` });
            } else if (!cartItem.reserved && product.countInStock < cartItem.quantity) {
                const message = `${product.name}\nOrder for ${cartItem.quantity}, but only ${product.countInStock} left in stock.`;
                return res.status(400).json({ message });
            }
        }

        let customerId;
        if (user.paymentCustomerId) {
            customerId = user.paymentCustomerId;
        } else {
            const customer = await stripe.customers.create({
                metadata: { userId: tokenData.id }
            });
            customerId = customer.id;
        }

        const session = await stripe.checkout.sessions.create({
            line_items: req.body.cartItems.map((item) => {
                return {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: item.name,
                            image: item.images,
                            metadata: {
                                productId: item.productId,
                                cartProductId: item.cartProductId,
                                selectedSize: item.selectedSize ?? undefined,
                                selectedColor: item.selectedColor ?? undefined
                            }
                        },
                        unit_amount: (item.price * 100).toFixed(0)
                    },
                    quantity: item.quantity
                };
            }),
            payment_method_options: {
                card: { setup_future_usage: 'on_session' }
            },
            billing_address_collection: 'auto',
            shipping_address_collection: {
                allowed_countries: [
                    'AU',
                    'AT',
                    'BE',
                    'BR',
                    'BG',
                    'CA',
                    'CI',
                    'HR',
                    'CY',
                    'CZ',
                    'DK',
                    'EE',
                    'FI',
                    'FR',
                    'DE',
                    'GH',
                    'GI',
                    'GR',
                    'HK',
                    'HU',
                    'IN',
                    'ID',
                    'IE',
                    'IT',
                    'JP',
                    'KE',
                    'LV',
                    'LI',
                    'LT',
                    'LU',
                    'MY',
                    'MT',
                    'MX',
                    'NL',
                    'NZ',
                    'NG',
                    'NO',
                    'PL',
                    'PT',
                    'RO',
                    'SG',
                    'SK',
                    'SI',
                    'ZA',
                    'ES',
                    'SE',
                    'CH',
                    'TH',
                    'AE',
                    'GB',
                    'US'
                ]
            },
            phone_number_collection: { enabled: true },
            customer: customerId,
            mode: 'payment',
            successful_url: 'https://dbestech.biz/payment-success',
            cancel_url: 'https://dbestech.biz/cart'
        });
        
        return res.status(201).json({ url: session.url });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.webhook = async (req, res) => {
    let event = req.body;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Only verify the event if you have an endpoint secret defined.
    // Otherwise use the basic event deserialized with JSON.parse
    if (endpointSecret) {
        // Get the signature sent by Stripe
        const signature = req.headers['stripe-signature'];
        try {
            event = stripe.webhooks.constructEvent(
              req.body,
              signature,
              endpointSecret
            );
        } catch (e) {
            console.log(`⚠️  Webhook signature verification failed.`, e.message);
            return res.sendStatus(400);
        }
    }

    if (event.type === 'checkout.session.complete') {
        const session = event.data.object;

        stripe.customers.retrieve(session.customer)
            .then(async (customer) => {
                const lineItems = await stripe.checkout.sessions.listLineItems(
                    session.id,
                    { expand: ['data.price.product'] }
                );

                const orderItems = lineItems.data.map((item) => {
                    return {
                        quantity: item.quantity,
                        product: item.price.product.metadata.productId,
                        cartProduct: item.price.product.metadata.cartProductId,
                        productPrice: item.price.unit_amount / 100,
                        productName: item.price.product.name,
                        productImage: item.price.product.images[0],
                        selectedSize: item.price.product.metadata.selectedSize ?? undefined,
                        selectedColor: item.price.product.metadata.selectedColor ?? undefined
                    };
                });

                const address = session.shipping_details?.address ?? session.customer_details.address;
                const order = await orderController.addOrder({
                    orderItems,
                    shippingAddress: address.line1 === 'N/A' ? address.line2 : address.line1,
                    city: address.city,
                    postalCode: address.postal_code,
                    country: address.country,
                    phone: session.customer_details.phone,
                    totalPrice: session.amount_total / 100,
                    user: customer.metadata.userId,
                    paymentId: session.payment_intent
                });

                let user = await User.findById(customer.metadata.userId);
                if (user && !user.paymentCustomerId) {
                    user = await User.findByIdAndUpdate(
                        customer.metadata.userId,
                        { paymentCustomerId: session.customer },
                        { new: true }
                    );
                }

                const leanOrder = order.toObject();
                leanOrder['orderItems'] = orderItems;
                await emailSender.sendMail(
                    session.customer_details.email ?? user.email,
                    'Your Ecomly Order',
                    mailBuilder.buildEmail(
                        user.name,
                        leanOrder,
                        session.customer_details.name
                    )
                );
            })
            .catch((e) => {
                console.error(`WEBHOOK ERROR CATCHER : ${e.message}`);
            });
    } else {
        console.log(`Unhandled event type ${event.type}`);
    }

    res.send().end();
};