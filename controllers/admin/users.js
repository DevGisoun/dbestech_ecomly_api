const { User } = require('../../models/user');
const { Order } = require('../../models/order');
const { OrderItem } = require('../../models/order_item');
const { CartProduct } = require('../../models/cart_product');
const { Token } = require('../../models/token');

exports.getUserCount = async function (req, res) {
    try {
        const userCount = await User.countDocuments();
        if (!userCount) {
            return res.status(500).json({ message: 'Could not count users.' });
        }

        return res.json({ userCount });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
}

exports.deleteUser = async function (req, res) {
    try {
        const userId = req.params.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User Not Found.' });
        }

        const orders = await Order.find({ user: userId });
        const orderItemIds = orders.flatMap((order) => order.orderItems);

        await Order.deleteMany({ user: userId });
        await OrderItem.deleteMany({ _id: { $in: orderItemIds } }); // WHERE _id IN orderItemIds

        await CartProduct.deleteMany({ _id: { $in: user.cart } });

        await User.findByIdAndUpdate(userId, {
            $pull: {
                cart: {
                    $exists: true
                }
            }
        });

        await Token.deleteOne({ userId });
        
        await User.deleteOne({ _id: userId });
        
        return res.status(204).end();
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
}