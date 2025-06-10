const { upload } = require('../../helpers/media_helper');
const util = require('util');
const { Category } = require('../../models/category');
const { json } = require('body-parser');

exports.addCategory = async function (req, res) {
    try {
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

        let category = new Category(req.body);
        category = await category.save();
        if (!category) return res.status(500).json({ message: 'The category could not be created.' });

        return res.status(201).json(category);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.editCategory = async function (req, res) {
    try {
        const { name, icon, color } = req.body;
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { name, icon, color },
            { new: true }
        );
        if (!category) return res.status(404).json({ message: 'Category not found.' });

        return res.json(category);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.deleteCategory = async function (req, res) {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ message: 'Category not found.' });

        category.markedForDeletion = true;
        await category.save();

        return res.status(204).end();
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};