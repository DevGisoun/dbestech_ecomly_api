const { User } = require('../models/user');
const { Review } = require('../models/review');
const { Product } = require('../models/product');
const { default: mongoose } = require('mongoose');
const jwt = require('jsonwebtoken');

/**
 * @param {string} [req.body] - comment, rating 포함.
 * @param {string} [req.body.user] - User ObjectId
 * @param {string} [req.params.id] - Product ObjectId 
 * @returns 
 */
exports.leaveReview = async (req, res) => {
    try {
        const user = await User.findById(req.body.user);
        if (!user) return res.status(404).json({ message: 'Invalid User.' });

        const review = await new Review({
            ...req.body,
            userName: user.name
        }).save();
        if (!review) return res.status(400).json({ message: 'The review could not be added.' });

        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found.' });

        product.reviews.push(review.id);
        product = await product.save();
        if (!product) return res.status(500).json({ message: 'Internal server error.' });

        return res.status(201).json({ product, review });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.getProductReviews = async (req, res) => {
    // DB 작업을 위한 새 Session 시작.
    const session = await mongoose.startSession();

    // DB Transaction 시작.
    session.startTransaction();

    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            // 모든 DB 변경사항 롤백.
            await session.abortTransaction();
            return res.status(404).json({ message: 'Product not found.' });
        }

        const page = req.query.page || 1;
        const pageSize = 10;

        const reviews = await Review
            .find({ _id: { $in: product.reviews } })
            .sort({ date: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize);
        
        const processedReviews = [];
        for (const review of reviews) {
            const user = await User.findById(review.user);
            if (!user) {
                processedReviews.push(review);
                continue;
            }

            let newReview;
            if (review.userName !== user.name) {
                review.userName = user.name;

                // { session } 옵션 추가 : 현재 작업이 Transaction에 포함되도록 설정.
                newReview = await review.save({ session });
            }
            
            processedReviews.push(newReview ?? review);
        }

        // 모든 DB 변경사항 커밋.
        await session.commitTransaction();

        return res.json(processedReviews);
    } catch (e) {
        console.error(e);
        // 모든 DB 변경사항 롤백.
        await session.abortTransaction();
        return res.status(500).json({ type: e.name, message: e.message });
    } finally {
        // DB Session 종료.
        await session.endSession();
    }
};