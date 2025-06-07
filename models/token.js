const { Schema, model } = require("mongoose");

const tokenSchema = Schema({
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    refreshToken: { type: String, required: true },
    accessToken: String,
    createdAt: { type: Date, default: Date.now(), expires: 60 * 24 * 60 * 60 } // 60일 * 하루(24시간 * 60분 * 60초)
});

exports.Token = model('Token', tokenSchema);