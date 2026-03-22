"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeysRouter = void 0;
var express_1 = require("express");
var zod_1 = require("zod");
var crypto_1 = require("crypto");
var pool_1 = require("../db/pool");
var auth_1 = require("../middleware/auth");
exports.apiKeysRouter = (0, express_1.Router)();
exports.apiKeysRouter.use(auth_1.requireApiKey);
// ── POST /v1/api-keys ─────────────────────────
// Generate a new API key for the workspace
exports.apiKeysRouter.post('/', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceId, _a, name_1, expiresInDays, rawKey, keyPrefix, keyHash, expiresAt, result, err_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                workspaceId = req.auth.workspaceId;
                _a = zod_1.z.object({
                    name: zod_1.z.string().min(1).max(100),
                    expiresInDays: zod_1.z.number().int().positive().optional(),
                }).parse(req.body), name_1 = _a.name, expiresInDays = _a.expiresInDays;
                rawKey = "po_live_".concat((0, crypto_1.randomBytes)(32).toString('hex'));
                keyPrefix = rawKey.slice(0, 16);
                keyHash = (0, crypto_1.createHash)('sha256').update(rawKey).digest('hex');
                expiresAt = expiresInDays
                    ? new Date(Date.now() + expiresInDays * 86400000)
                    : null;
                return [4 /*yield*/, pool_1.db.query("INSERT INTO api_keys (workspace_id, name, key_hash, key_prefix, expires_at)\n       VALUES ($1, $2, $3, $4, $5)\n       RETURNING id, name, key_prefix, expires_at, created_at", [workspaceId, name_1, keyHash, keyPrefix, expiresAt])
                    // Return the raw key ONCE — we never store it
                ];
            case 1:
                result = _b.sent();
                // Return the raw key ONCE — we never store it
                res.status(201).json(__assign(__assign({}, result.rows[0]), { key: rawKey, warning: 'Save this key now. It will not be shown again.' }));
                return [3 /*break*/, 3];
            case 2:
                err_1 = _b.sent();
                next(err_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ── GET /v1/api-keys ──────────────────────────
// List all API keys (prefixes only, never full keys)
exports.apiKeysRouter.get('/', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceId, result, err_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                workspaceId = req.auth.workspaceId;
                return [4 /*yield*/, pool_1.db.query("SELECT id, name, key_prefix, last_used_at, expires_at, created_at\n       FROM api_keys\n       WHERE workspace_id = $1\n       ORDER BY created_at DESC", [workspaceId])];
            case 1:
                result = _a.sent();
                res.json({ apiKeys: result.rows });
                return [3 /*break*/, 3];
            case 2:
                err_2 = _a.sent();
                next(err_2);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ── DELETE /v1/api-keys/:id ───────────────────
// Revoke an API key immediately
exports.apiKeysRouter.delete('/:id', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceId, err_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                workspaceId = req.auth.workspaceId;
                return [4 /*yield*/, pool_1.db.query('DELETE FROM api_keys WHERE id = $1 AND workspace_id = $2', [req.params['id'], workspaceId])];
            case 1:
                _a.sent();
                res.json({ message: 'API key revoked.' });
                return [3 /*break*/, 3];
            case 2:
                err_3 = _a.sent();
                next(err_3);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
