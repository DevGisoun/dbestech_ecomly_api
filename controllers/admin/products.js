const { Product } = require('../../models/product');
const { upload, deleteImages } = require('../../helpers/media_helper');
const util = require('util');
const { Category } = require('../../models/category');
const { MulterError } = require('multer');
const { default: mongoose } = require('mongoose');
const { Review } = require('../../models/review');

exports.getProductsCount = async function (_, res) {
    try {
        const productCount = await Product.countDocuments();
        if (!productCount) return res.status(500).json({ message: 'Could not count products.' });

        return res.json({ count });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.getProducts = async function (req, res) {
    try {
        const page = req.query.page || 1;
        const pageSize = 10;

        const products = await Product.find()
            .select('-reviews -rating')
            /**
             * ex)  page: 1, pageSize: 10
             *      (1 - 1) * 10 = 0 -> 1페이지의 경우 0개를 건너뛰고 처음부터 조회.
             * ex)  page: 2, pageSize: 10
             *      (2 - 1) * 10 = 10 -> 2페이지의 경우 10개를 건너뛰고 11번째부터 조회.
             */
            .skip((page - 1) * pageSize)
            .limit(pageSize);
        
        if (!products) return res.status(404).json({ message: 'Products not found.' });

        return res.json(products);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.addProduct = async function (req, res) {
    try {
        const uploadImage = util.promisify( // Promise를 반환하는 비동기 함수로 변환.
            upload.fields([
                { name: 'image', maxCount: 1 }, // 'image' 필드에서 최대 1개의 파일을 업로드받도록 설정.
                { name: 'images', maxCount: 10 } // 'images' 필드에서 최대 10개의 파일을 업로드받도록 설정.
            ]) 
        );

        try {
            // 이미지 업로드 실행.
            // media_helper의 유효성 검사에 실패 시, 아래 catch로 이동.
            await uploadImage(req, res);
        } catch (e) {
            console.error(e);
            return res.status(500).json({
                type: e.code,
                message: `${e.message}{${e.field}}`,
                storageErrors: e.storageErrors
            });
        }

        const category = await Category.findById(req.body.category);
        if (!category) return res.status(404).json({ message: 'Invalid Category.' });
        if (category.markedForDeletion) {
            return res.status(500).json({ message: 'Category marked for deletion, you cannot add products to this category.' });
        }

        // 업로드된 이미지의 상세 정보.
        const image = req.files['image'][0];
        if (!image) return res.status(404).json({ message: 'No file found.' });

        // 이미지 URL 구성.
        // ex) http://domain.com/public/uploads/image-name.jpg
        req.body['image'] = `${req.protocol}://${req.get('host')}/${image.path}`;

        const gallery = req.files['images'];
        const imagePaths = [];

        if (gallery) {
            for (const image of gallery) {
                const imagePath = `${req.protocol}://${req.get('host')}/${image.path}`;
                imagePaths.push(imagePath);
            }
        }

        if (imagePaths.length > 0) {
            req.body['images'] = imagePaths;
        }

        const product = await new Product(req.body).save();
        if (!product) return res.status(500).json({ message: 'The product could not be created.' });

        return res.status(201).json(product);
    } catch (e) {
        console.error(e);

        if (e instanceof MulterError) {
            return res.status(e.code).json({ message: e.message });
        }

        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.editProduct = async function (req, res) {
    try {
        if (
            !mongoose.isValidObjectId(req.params.id) ||
            !(await Product.findById(req.params.id))
        ) {
            return res.status(404).json({ message: 'Invalid product.' });
        }

        if (req.body.category) {
            const category = await Category.findById(req.body.category);
            if (!category) return res.status(404).json({ message: 'Invalid Category.' });
            if (category.markedForDeletion) {
                return res.status(500).json({ message: 'Category marked for deletion, you cannot add products to this category.' });
            }

            const product = await Product.findById(req.params.id);

            if (req.body.image) {
                const limit = 10 - product.images.length;
                const uploadGallery = util.promisify(
                    upload.fields([
                        { name: 'images', maxCount: limit } // 'images' 필드에서 최대 limit 만큼의 파일을 업로드받도록 설정.
                    ])
                );

                try {
                    // 다수의 이미지 업로드 실행.
                    // media_helper의 유효성 검사에 실패 시, 아래 catch로 이동.
                    await uploadGallery(req, res);
                } catch (e) {
                    console.error(e);
                    return res.status(500).json({
                        type: e.code,
                        message: `${e.message}{${e.field}}`,
                        storageErrors: e.storageErrors
                    });
                }

                const imageFiles = req.files['images'];
                const updateGallery = imageFiles && imageFiles.length > 0;
                if (updateGallery) {
                    const imagePaths = [];
                    for (const image of imageFiles) {
                        const imagePath = `${req.protocol}://${req.get('host')}/${image.path}`;
                        imagePaths.push(imagePath);
                    }

                    req.body['images'] = [
                        ...product.images,
                        ...imagePaths
                    ];
                }
            }

            if (req.body.image) {
                const uploadImage = util.promisify( // Promise를 반환하는 비동기 함수로 변환.
                    upload.fields([{ name: 'image', maxCount: 1 }]) // 'image' 필드에서 최대 1개의 파일을 업로드받도록 설정.
                );
        
                try {
                    // 이미지 업로드 실행.
                    // media_helper의 유효성 검사에 실패 시, 아래 catch로 이동.
                    await uploadImage(req, res);
                } catch (e) {
                    console.error(e);
                    return res.status(500).json({
                        type: e.code,
                        message: `${e.message}{${e.field}}`,
                        storageErrors: e.storageErrors
                    });
                }
        
                // 업로드된 이미지의 상세 정보.
                const image = req.files['image'][0];
                if (!image) return res.status(404).json({ message: 'No file found.' });

                // 이미지 URL 구성.
                // ex) http://domain.com/public/uploads/image-name.jpg
                req.body['image'] = `${req.protocol}://${req.get('host')}/${image.path}`;
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updatedProduct) return res.status(404).json({ message: 'Product not found.' });

        return res.json(updatedProduct);
    } catch (e) {
        console.error(e);

        if (e instanceof MulterError) {
            return res.status(e.code).json({ message: e.message });
        }

        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.deleteProductImages = async function (req, res) {
    try {
        const productId = req.params.id;
        const { deletedImageUrls } = req.body;

        if (
            !mongoose.isValidObjectId(productId) ||
            !Array.isArray(deletedImageUrls)
        ) {
            return res.status(400).json({ message: 'Invalid request data.' });
        }

        await deleteImages(deletedImageUrls);

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: 'Product not found.' });

        product.images = product.images.filter((image) => !deletedImageUrls.includes(image));

        await product.save();

        return res.status(204).end();
    } catch (e) {
        console.error(`Error deleting product: ${e.message}`);

        if (e.code === 'ENOENT') {
            return res.status(404).json({ message: 'Image not found.' });
        }

        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.deleteProduct = async function (req, res) {
    try {
        const productId = req.params.id;

        if (!mongoose.isValidObjectId(productId)) {
            return res.status(404).json({ message: 'Invalid Product.' });
        }
        
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: 'Product not found.' });

        await deleteImages(
            [
                ...product.images,
                product.image
            ],
            'ENOENT'
        );

        await Review.deleteMany({ _id: { $in: product.reviews } });

        await Product.findByIdAndDelete(productId);

        return res.status(204).end();
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};