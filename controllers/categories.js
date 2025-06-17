const { Category } = require("../models/category");

exports.getCategories = async (_, res) => {
    try {
        const categories = await Category.find();
        if (!categories) {
            return res.status(404).json({ message: 'Categories Not Found' });
        }

        return res.json(categories);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category Not Found' });
        }

        return res.json(category);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};