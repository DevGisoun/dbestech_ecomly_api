const cron = require('node-cron');
const { Category } = require('../models/category');
const { Product } = require('../models/product');
const { default: mongoose } = require('mongoose');
const { CartProduct } = require('../models/cart_product');

/**
 * 매일 자정 실행.
 *
 * @summary 삭제 예정(markedForDeletion: true) 카테고리를 주기적으로 DB에서 영구적으로 삭제.
 * 
 * @description 'markedForDeletion' 플래그가 true로 설정된 카테고리를 모두 조회.
 * 각 카테고리에 대해 연결된 상품이 하나도 없는지 확인한 후,
 * 없는 경우에만 DB에서 해당 카테고리를 영구적으로 삭제하여 데이터 무결성 보장.
 *
 */
cron.schedule('0 0 * * *', async () => {
    try {
        const categoriesToBeDeleted = await Category.find({ markedForDeletion: true });

        for (const category of categoriesToBeDeleted) {
            const categoryProductsCount = await Product.countDocuments({ category: category.id });
            if (categoryProductsCount < 1) await category.deleteOne();
        }

        console.log(`CRON job completed at ${new Date()}`);
    } catch (e) {
        console.error(`CRON job error: ${e}`);
    }
});

/**
 * 매 30분마다 실행.
 *
 * @summary 장바구니(CartProduct) 내 상품 예약 시간(reservationExpiry) 만료(reserved: true) 처리.
 * 
 * @description
 * 장바구니에 담긴 상품 중 예약 시간이 만료된 건들을 처리하여
 * 다른 사용자가 구매할 수 있도록 재고 및 예약 상태를 원래대로 복구하는 기능 처리.
 */
cron.schedule('*/30 * * * *', async () => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log(`Reservation release CRON job started at ${new Date()}`);

        const expiredReservations = await CartProduct.find({
            reserved: true,
            reservationExpiry: { $lte: new Date() }
        }).session(session);

        for (const cartProduct of expiredReservations) {
            const product = await Product.findById(cartProduct.product).session(session);
            if (product) {
                const updatedProduct = await Product.findByIdAndUpdate(
                    product._id,
                    { $inc: { countInStock: cartProduct.quantity } },
                    { new: true, runValidators: true, session }
                );

                if (!updatedProduct) {
                    console.error('Error Occurred: Product update failed. Potential concurrency issue.');
                    await session.abortTransaction();
                    return;
                }
            }

            await CartProduct.findByIdAndUpdate(
                cartProduct._id,
                { reserved: false },
                { session }
            );
        }

        await session.commitTransaction();

        console.log(`Reservation release CRON job completed at ${new Date()}`);
    } catch (e) {
        console.error(`CRON job error: ${e}`);
        await session.abortTransaction();
    } finally {
        await session.endSession();
    }
});