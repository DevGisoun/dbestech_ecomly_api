const { default: mongoose } = require('mongoose');
const { Product } = require('../models/product');
const { User } = require('../models/user');

exports.getUserWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const wishlist = [];
        for (const wishProduct of user.wishlist) {
            const product = await Product.findById(wishProduct.productId);
            if (!product) { // 상품이 존재하지 않는 경우. (ex. 사용자가 위시리스트에 담은 이후, 관리자가 해당 상품을 삭제한 경우.)
                wishlist.push({
                    ...wishProduct,
                    productExists: false, // 상품 존재 여부.
                    productOutOfStock: false // 상품 품절 여부.
                });
            } else if (product.countInStock < 1) { // 상품은 존재하지만 재고가 없는 경우. (ex. 품절)
                wishlist.push({
                    ...wishProduct,
                    productExists: true,
                    productOutOfStock: true
                });
            } else { // 상품이 존재하고 재고도 있는 경우.
                wishlist.push({
                    productId: product._id,
                    productImage: product.image,
                    productPrice: product.price,
                    productName: product.name,
                    productExists: true,
                    productOutOfStock: false,
                });
            }
        }

        return res.json(wishlist);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.addToWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const product = await Product.findById(req.body.productId);
        if (!product) return res.status(404).json({ message: 'Could not add product. Product not found.' });

        const productAlreadyExists = user.wishlist.find((item) => 
            item.productId.equals(new mongoose.Schema.Types.ObjectId(req.body.productId))
        );
        if (productAlreadyExists) {
            return res.status(409).json({ message: 'Product already exists in wishlist.' });
        }

        user.wishlist.push({
            productId: req.body.productId,
            productImage: product.image,
            productPrice: product.price,
            productName: product.name
        });

        await user.save();
        
        return res.status(200).end();
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.removeFromWishlist = async (req, res) => {
    try {
        const userId = req.params.id;
        const productId = req.params.productId;
        
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const index = user.wishlist.findIndex((item) => 
            item.productId.equals(new mongoose.Schema.Types.ObjectId(productId))
        );

        if (index === -1) return res.status(404).json({ message: 'Product not found in wishlist.' });

        user.wishlist.splice(index, 1);

        await user.save();

        return res.status(204).end();
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};