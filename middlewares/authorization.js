/**
 * @file 전역 인가(Authorization) 처리 미들웨어.
 * @description Express 애플리케이션에 전역으로 사용될 인가(Authorization) 미들웨어.
 * POST 요청에 한하여, 한 사용자가 다른 사용자의 데이터를 생성 및 수정하려는 시도를 방지하는 것을 주 목적으로 사용.
 */

const jwt = require('jsonwebtoken');
const { default: mongoose } = require('mongoose');

/**
 * @summary POST 요청에 대한 인가(Authorization) 처리를 수행하는 미들웨어 함수.
 *
 * @description 이 함수는 전역(`app.use()`)으로 사용되는 것을 전제로 설계되었으며,
 * 자신이 처리할 필요가 없는 요청(POST 요청이 아니거나, 특정 경로에 해당)은 빠르게
 * 다음 미들웨어로 제어를 넘김(`next()`).
 */
async function authorizePostRequests(req, res, next) {
    // POST 요청이 아닐 경우, 이 미들웨어의 검사 대상이 아니므로 즉시 통과(`next()`).
    if (req.method !== 'POST') return next();
    
    const API = process.env.API_URL;

    // 관리자 관련 경로는 별도의 권한 체계를 가지므로, 이 미들웨어에서는 처리하지 않고 통과.
    if (req.originalUrl.startsWith(`${API}/admin`)) return next();

    // 인가가 필요 없는 공개된 API 엔드포인트 목록.
    const endpoints = [
        `${API}/login`,
        `${API}/register`,
        `${API}/forgot-password`,
        `${API}/verify-otp`,
        `${API}/reset-password`
    ];

    // 요청 URL이 endpoints 리스트에 포함된 경우, 검사하지 않고 통과.
    const isMatchingEndpoint = endpoints.some((endpoint) => req.originalUrl.includes(endpoint));
    if (isMatchingEndpoint) return next();

    // 에러 메세지.
    const message = 'User conflict.\nThe user making the request dose not match the user in the request.';

    // Authorization 헤더가 없으면 다른 미들웨어가 처리하도록 통과.
    const authHeader = req.header('Authorization');
    if (!authHeader) return next();

    const accessToken = authHeader.replace('Bearer', '').trim();
    const tokenData = jwt.decode(accessToken); // 추후 jwt.verify 사용을 통한 서명 검증 필요.

    if (req.body.user && tokenData.id !== req.body.user) { // Request의 body에 'user' ObjectId가 포함된 경우.
        // 토큰의 주인과 Request의 body의 주인이 다르면, 권한 없음(401) 처리.
        return res.status(401).json({ message });
    } else if (/\/users\/([^/]+)\//.test(req.originalUrl)) { // URL 경로에 '/users/:id/' 패턴으로 사용자 ID가 포함된 경우.
        const parts = req.originalUrl.split('/');
        const usersIndex = parts.indexOf('users');
        
        // URL에서 :id 부분만 추출.
        const id = parts[usersIndex + 1];

        // 추출된 :id가 유효한 MongoDB ObjectId 형식이 아니면 검사할 필요가 없으므로 통과.
        if (!mongoose.isValidObjectId(id)) return next();

        // 토큰의 주인과 URL의 주인이 다르면, 권한 없음(401) 처리.
        if (tokenData.id !== id) return res.status(401).json({ message });
    }

    // 위의 모든 검사를 통과한 요청은 허가된 것으로 판단.
    // 다음 미들웨어로 제어 넘김.
    return next();
};

module.exports = authorizePostRequests;