const express = require('express');

const router = express.Router();

const usersController = require('../controllers/users');
const wishlistsController = require('../controllers/wishlists');
const cartController = require('../controllers/cart');

// User
router.get('/', usersController.getUsers);
router.get('/:id', usersController.getUserById);
router.put('/:id', usersController.updateUser);

// Wishlist
router.get('/:id/wishlist', wishlistsController.getUserWishlist);
router.post('/:id/wishlist', wishlistsController.addToWishlist);
router.delete('/:id/wishlist/:productId', wishlistsController.removeFromWishlist);

// Cart
router.get('/:id/cart', cartController.getUserCart);
router.get('/:id/cart/count', cartController.getUserCartCount);
router.get('/:id/cart/:cartProductId', cartController.getCartProductById);
router.post('/:id/cart', cartController.addToCart);
router.put('/:id/cart/:cartProductId', cartController.modifyProductQuantity);
router.delete('/:id/cart/:cartProductId', cartController.removeFromCart);

module.exports = router;