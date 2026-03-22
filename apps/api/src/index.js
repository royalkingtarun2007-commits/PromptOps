"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("dotenv/config");
var express_1 = require("express");
var cors_1 = require("cors");
var helmet_1 = require("helmet");
var express_rate_limit_1 = require("express-rate-limit");
var pool_1 = require("./db/pool");
var prompts_1 = require("./routes/prompts");
var experiments_1 = require("./routes/experiments");
var apiKeys_1 = require("./routes/apiKeys");
var errors_1 = require("./middleware/errors");
// ── App Setup ─────────────────────────────────
var app = (0, express_1.default)();
exports.app = app;
var PORT = (_a = process.env['PORT']) !== null && _a !== void 0 ? _a : 3001;
// ── Security Middleware ───────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (_c = (_b = process.env['ALLOWED_ORIGINS']) === null || _b === void 0 ? void 0 : _b.split(',')) !== null && _c !== void 0 ? _c : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
}));
// Rate limiting — 200 requests per minute per IP
app.use((0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
}));
app.use(express_1.default.json({ limit: '1mb' }));
// ── Health Check ──────────────────────────────
app.get('/health', function (_req, res) {
    res.json({
        status: 'ok',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
    });
});
// ── Routes ────────────────────────────────────
app.use('/v1/prompts', prompts_1.promptsRouter);
app.use('/v1/experiments', experiments_1.experimentsRouter);
app.use('/v1/api-keys', apiKeys_1.apiKeysRouter);
// ── 404 Handler ───────────────────────────────
app.use(function (_req, res) {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Route not found. Check the PromptOps API docs.',
    });
});
// ── Error Handler (must be last) ──────────────
app.use(errors_1.errorHandler);
// ── Start ─────────────────────────────────────
function start() {
    return __awaiter(this, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, pool_1.connectDB)()];
                case 1:
                    _a.sent();
                    app.listen(PORT, function () {
                        console.log("\uD83D\uDE80 PromptOps API running on http://localhost:".concat(PORT));
                        console.log("   Health: http://localhost:".concat(PORT, "/health"));
                    });
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    console.error('Failed to start server:', err_1);
                    process.exit(1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Graceful shutdown
process.on('SIGTERM', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('SIGTERM received, shutting down...');
                return [4 /*yield*/, (0, pool_1.closeDB)()];
            case 1:
                _a.sent();
                process.exit(0);
                return [2 /*return*/];
        }
    });
}); });
start();
