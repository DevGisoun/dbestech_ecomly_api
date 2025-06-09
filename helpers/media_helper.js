const { unlink } = require('fs/promises');
const multer = require('multer');
const path = require('path');

const ALLOWED_EXTENSIONS = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg'
};

const storage = multer.diskStorage({
    destination: function (_, __, callback) { // 저장 경로 설정
        callback(null, 'public/uploads');
    },
    filename: function (_, file, callback) { // 파일명 설정
        const filename = file.originalname
            .replace(' ', '-') // 공백 -> '-'
            // 확장자 (ALLOWED_EXTENSIONS) 제거
            .replace('.png', '')
            .replace('.jpeg', '')
            .replace('.jpg', '');
        
        const extension = ALLOWED_EXTENSIONS[file.mimetype];
        callback(null, `${filename}-${Date.now()}.${extension}`);
    }
});

exports.upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB
    },
    fileFilter: (_, file, callback) => {
        const isValid = ALLOWED_EXTENSIONS[file.mimetype];
        let uploadError = new Error(`Invalid image type\n${file.mimetype} is not allowed.`);
        
        if (!isValid) return callback(uploadError);

        return callback(null, true);
    }
});

exports.deleteImages = async function (imageUrls, continueOnErrorName) {
    await Promise.all(
        imageUrls.map(async (imageUrl) => {
            const imagePath = path.resolve(
                __dirname,
                '..',
                'public',
                'uploads',
                path.basename(imageUrl)
            );

            try {
                await unlink(imagePath);
            } catch (e) {
                if (e.code === continueOnErrorName) {
                    console.error(`Continuing with the next image: ${e.message}`);
                } else {
                    console.error(`Error deleting image: ${e.message}`);
                    throw e;
                }
            }
        })
    );
}