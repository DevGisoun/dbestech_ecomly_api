const { Product } = require("../models/product");

exports.getProducts = async (req, res) => {
    try {
        let products;
        const page = req.query.page || 1;
        const pageSize = 10;

        if (req.query.criteria) { // 2주 내 추가된 상품, 평점 4.5 이상 상품 등 특정 기준 필터링.
            // MongoDB에 전달할 Filter 조건을 담을 빈 객체 선언.
            let query = {};
            
            if (req.query.category) query['category'] = req.query.category;

            switch (req.query.criteria) {
                case 'newArrivals': { // 최근 2주 이내에 추가된 상품 조회.
                    const twoWeeksAgo = new Date();
                    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
                    query['dateAdded'] = { $gte: twoWeeksAgo };
                    break;
                }
                case 'popular': { // 평점 4.5점 이상인 상품 조회.
                    query['rating'] = { $gte: 4.5 };
                    break;
                }
                default: {
                    break;
                }
            }

            /**
             * $gte: MongoDB에서 사용되는 연산자. 크거나 같은(>=) 조건을 표현.
             */

            products = await Product.find(query)
                .select('-images -reviews -size')
                .skip((page - 1) * pageSize)
                .limit(pageSize);
        } else if (req.query.category) { // 특정 카테고리 내의 상품 필터링.
            products = await Product.find({ category: req.query.category })
                .select('-images -reviews -size')
                .skip((page - 1) * pageSize)
                .limit(pageSize);
        } else { // 모든 상품 필터링.
            products = await Product.find()
                .select('-images -reviews -size')
                .skip((page - 1) * pageSize)
                .limit(pageSize);
        }

        if (!products) return res.status(404).json({ message: 'Products not found.' });

        return res.json(products);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

/**
 * @param {string} [req.query.q] - 검색어.
 * @param {string} [req.query.page = 1] - 페이지 번호 (default: 1).
 * @param {string} [req.query.category] - 상품 카테고리.
 * @param {string} [req.query.genderAgeCategory] - 성별 및 연령대 카테고리.
 */
exports.searchProducts = async (req, res) => {
    try {
        // 검색어.
        const searchTerm = req.query.q;

        const page = req.query.page || 1;
        const pageSize = 10;

        let query = {};
        if (req.query.category) {
            query = { category: req.query.category };

            if (req.query.genderAgeCategory) {
                query['genderAgeCategory'] = req.query.genderAgeCategory.toLowerCase();
            }
        } else if (req.query.genderAgeCategory) {
            query = { genderAgeCategory: req.query.genderAgeCategory.toLowerCase() };
        }

        if (searchTerm) {
            query = {
                ...query,
                $text: { // models/product.js 에서 정의한 'text' 인덱스가 설정된 필드들(name, description) 내에서 검색 시도.
                    $search: searchTerm, // searchTerm에 포함된 단어 검색.
                    $language: 'english', // 영어 문법에 맞춰 검색. (어간 추출, 불용어 처리 등)
                    // 한국어 검색 기능 도입 시에는 MongoDB의 Atlas Search 서비스 이용.
                    $caseSensitive: false // 대소문자 구분 X.
                }
            };
        }

        const searchResults = await Product.find(query)
            .skip((page - 1) * pageSize)
            .limit(pageSize);

        return res.json(searchResults);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).select('-reviews');
        if (!product) return res.status(404).json({ message: 'Product not found.' });

        return res.json(product);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};