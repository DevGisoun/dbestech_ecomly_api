const { default: mongoose } = require("mongoose");
const { User } = require("../models/user");
const { CartProduct } = require("../models/cart_product");
const { OrderItem } = require("../models/order_item");
const { Product } = require("../models/product");
const { Order } = require("../models/order");

exports.addOrder = async function(orderData) {
    if (!mongoose.isValidObjectId(orderData.user)) return console.error(`User Validation Failed : Invalid User.`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(orderData.user);
        if (!user) {
            await session.abortTransaction();
            return console.trace('ORDER CREATION FAILED : User not found.');
        }

        const orderItems = orderData.orderItems;
        const orderItemIds = [];

        for (const orderItem of orderItems) {
            if (
                !mongoose.isValidObjectId(orderItem.product) ||
                !(await Product.findById(orderItem.product))
            ) {
                await session.abortTransaction();
                return console.trace('ORDER CREATION FAILED : Invalid product in the order.');
            }

            const cartProduct = await CartProduct.findById(orderItem.cartProductId);
            const product = await Product.findById(orderItem.product);
            if (!cartProduct) {
                await session.abortTransaction();
                return console.trace('ORDER CREATION FAILED : Invalid cart product in the order.'); 
            }

            let orderItemModel = await new OrderItem(orderItem).save({ session });
            if (!orderItemModel) {
                await session.abortTransaction();
                return console.trace(`ORDER CREATION FAILED : An order for product "${product.name}" could not be created.`); 
            }

            if (!cartProduct.reserved) {
                product.countInStock -= orderItemModel.quantity;
                await product.save({ session });
            }

            orderItemIds.push(orderItemModel._id);

            await CartProduct.findByIdAndDelete(orderItem.cartProductId).session(session);
            
            user.cart.pull(cartProduct.id);
            await user.save({ session });
        }

        orderData['orderItems'] = orderItemIds;

        let order = new OrderItem(orderData);
        order.status = 'processed';
        order.statusHistory.push('processed');

        order = await order.save({ session });

        if (!order.reserved) {
            await session.abortTransaction();
            return console.trace('ORDER CREATION FAILED : The order could not be created.'); 
        }

        await session.commitTransaction();

        return order;
    } catch (e) {
        await session.abortTransaction();
        return console.trace(e);
    } finally {
        await session.endSession();
    }
};