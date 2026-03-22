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
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptsRouter = void 0;
var express_1 = require("express");
var zod_1 = require("zod");
var pool_1 = require("../db/pool");
var auth_1 = require("../middleware/auth");
var errors_1 = require("../middleware/errors");
exports.promptsRouter = (0, express_1.Router)();
// All prompt routes require a valid API key
exports.promptsRouter.use(auth_1.requireApiKey);
// ── Schemas ───────────────────────────────────
var MessageSchema = zod_1.z.object({
    role: zod_1.z.enum(['system', 'user', 'assistant']),
    content: zod_1.z.string().min(1),
});
var CreatePromptSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'slug must be lowercase with hyphens only'),
    name: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    messages: zod_1.z.array(MessageSchema).min(1),
    variables: zod_1.z.array(zod_1.z.string()).default([]),
});
var UpdateVersionSchema = zod_1.z.object({
    messages: zod_1.z.array(MessageSchema).min(1),
    variables: zod_1.z.array(zod_1.z.string()).default([]),
    review_notes: zod_1.z.string().optional(),
});
var PromoteSchema = zod_1.z.object({
    environment: zod_1.z.string().min(1),
    version_id: zod_1.z.string().uuid(),
});
// ── GET /v1/prompts ───────────────────────────
// List all prompts in the workspace
exports.promptsRouter.get('/', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceId, _a, tag, search, query, params, result, err_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                workspaceId = req.auth.workspaceId;
                _a = req.query, tag = _a.tag, search = _a.search;
                query = "\n      SELECT\n        p.id, p.slug, p.name, p.description, p.tags,\n        p.created_at, p.updated_at,\n        COUNT(pv.id) AS version_count\n      FROM prompts p\n      LEFT JOIN prompt_versions pv ON pv.prompt_id = p.id\n      WHERE p.workspace_id = $1\n    ";
                params = [workspaceId];
                if (search) {
                    params.push("%".concat(search, "%"));
                    query += " AND (p.name ILIKE $".concat(params.length, " OR p.slug ILIKE $").concat(params.length, ")");
                }
                if (tag) {
                    params.push(tag);
                    query += " AND $".concat(params.length, " = ANY(p.tags)");
                }
                query += ' GROUP BY p.id ORDER BY p.updated_at DESC';
                return [4 /*yield*/, pool_1.db.query(query, params)];
            case 1:
                result = _b.sent();
                res.json({ prompts: result.rows, total: result.rowCount });
                return [3 /*break*/, 3];
            case 2:
                err_1 = _b.sent();
                next(err_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ── GET /v1/prompts/:slug ─────────────────────
// Fetch the active version of a prompt for a given environment
// This is the route the SDK calls
exports.promptsRouter.get('/:slug', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceId, slug, env, result, row, err_2;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                workspaceId = req.auth.workspaceId;
                slug = req.params.slug;
                env = req.query['env'] || 'production';
                return [4 /*yield*/, pool_1.db.query("SELECT\n        p.id AS prompt_id,\n        p.slug,\n        p.name,\n        p.tags,\n        pv.id AS version_id,\n        pv.version,\n        pv.messages,\n        pv.variables,\n        pv.approved_at,\n        u.email AS approved_by,\n        pr.environment AS env\n      FROM prompts p\n      JOIN promotions pr ON pr.prompt_id = p.id\n      JOIN prompt_versions pv ON pv.id = pr.prompt_version_id\n      LEFT JOIN users u ON u.id = pv.approved_by\n      WHERE p.workspace_id = $1\n        AND p.slug = $2\n        AND pr.environment = $3\n      LIMIT 1", [workspaceId, slug, env])];
            case 1:
                result = _b.sent();
                if (result.rowCount === 0) {
                    throw new errors_1.NotFoundError("Prompt \"".concat(slug, "\" in environment \"").concat(env, "\""));
                }
                row = result.rows[0];
                // Return in the exact shape the SDK expects
                res.json({
                    metadata: {
                        slug: row.slug,
                        name: row.name,
                        version: row.version,
                        env: row.env,
                        workspace: workspaceId,
                        approvedAt: row.approved_at,
                        approvedBy: (_a = row.approved_by) !== null && _a !== void 0 ? _a : 'system',
                        tags: row.tags,
                        variables: row.variables,
                    },
                    messages: row.messages,
                });
                return [3 /*break*/, 3];
            case 2:
                err_2 = _b.sent();
                next(err_2);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ── GET /v1/prompts/:slug/versions ────────────
// List all versions of a prompt
exports.promptsRouter.get('/:slug/versions', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceId, slug, prompt_1, result, err_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                workspaceId = req.auth.workspaceId;
                slug = req.params.slug;
                return [4 /*yield*/, getPromptBySlug(workspaceId, slug)];
            case 1:
                prompt_1 = _a.sent();
                return [4 /*yield*/, pool_1.db.query("SELECT\n        pv.id, pv.version, pv.status, pv.variables,\n        pv.review_notes, pv.created_at, pv.approved_at,\n        creator.email AS created_by,\n        approver.email AS approved_by\n      FROM prompt_versions pv\n      LEFT JOIN users creator ON creator.id = pv.created_by\n      LEFT JOIN users approver ON approver.id = pv.approved_by\n      WHERE pv.prompt_id = $1\n      ORDER BY pv.created_at DESC", [prompt_1.id])];
            case 2:
                result = _a.sent();
                res.json({ versions: result.rows });
                return [3 /*break*/, 4];
            case 3:
                err_3 = _a.sent();
                next(err_3);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// ── GET /v1/prompts/:slug/versions/:version ───
// Fetch a specific pinned version (used by SDK when version is pinned)
exports.promptsRouter.get('/:slug/versions/:version', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceId, _a, slug, version, result, row, err_4;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                workspaceId = req.auth.workspaceId;
                _a = req.params, slug = _a.slug, version = _a.version;
                return [4 /*yield*/, pool_1.db.query("SELECT\n        p.slug, p.name, p.tags,\n        pv.id, pv.version, pv.messages, pv.variables,\n        pv.approved_at, u.email AS approved_by\n      FROM prompts p\n      JOIN prompt_versions pv ON pv.prompt_id = p.id\n      LEFT JOIN users u ON u.id = pv.approved_by\n      WHERE p.workspace_id = $1\n        AND p.slug = $2\n        AND pv.version = $3\n      LIMIT 1", [workspaceId, slug, version])];
            case 1:
                result = _c.sent();
                if (result.rowCount === 0) {
                    throw new errors_1.NotFoundError("Prompt \"".concat(slug, "\" version \"").concat(version, "\""));
                }
                row = result.rows[0];
                res.json({
                    metadata: {
                        slug: row.slug,
                        name: row.name,
                        version: row.version,
                        env: 'pinned',
                        workspace: workspaceId,
                        approvedAt: row.approved_at,
                        approvedBy: (_b = row.approved_by) !== null && _b !== void 0 ? _b : 'system',
                        tags: row.tags,
                        variables: row.variables,
                    },
                    messages: row.messages,
                });
                return [3 /*break*/, 3];
            case 2:
                err_4 = _c.sent();
                next(err_4);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ── POST /v1/prompts ──────────────────────────
// Create a new prompt with its first version
exports.promptsRouter.post('/', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceId, body, existing, client, promptResult, promptId, versionResult, err_5, err_6;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 12, , 13]);
                workspaceId = req.auth.workspaceId;
                body = CreatePromptSchema.parse(req.body);
                return [4 /*yield*/, pool_1.db.query('SELECT id FROM prompts WHERE workspace_id = $1 AND slug = $2', [workspaceId, body.slug])];
            case 1:
                existing = _c.sent();
                if (((_a = existing.rowCount) !== null && _a !== void 0 ? _a : 0) > 0) {
                    throw new errors_1.ConflictError("A prompt with slug \"".concat(body.slug, "\" already exists."));
                }
                return [4 /*yield*/, pool_1.db.connect()];
            case 2:
                client = _c.sent();
                _c.label = 3;
            case 3:
                _c.trys.push([3, 8, 10, 11]);
                return [4 /*yield*/, client.query('BEGIN')];
            case 4:
                _c.sent();
                return [4 /*yield*/, client.query("INSERT INTO prompts (workspace_id, slug, name, description, tags)\n         VALUES ($1, $2, $3, $4, $5)\n         RETURNING id", [workspaceId, body.slug, body.name, (_b = body.description) !== null && _b !== void 0 ? _b : null, body.tags])];
            case 5:
                promptResult = _c.sent();
                promptId = promptResult.rows[0].id;
                return [4 /*yield*/, client.query("INSERT INTO prompt_versions (prompt_id, version, messages, variables, status)\n         VALUES ($1, 'v1', $2, $3, 'draft')\n         RETURNING id, version", [promptId, JSON.stringify(body.messages), body.variables])];
            case 6:
                versionResult = _c.sent();
                return [4 /*yield*/, client.query('COMMIT')];
            case 7:
                _c.sent();
                res.status(201).json({
                    id: promptId,
                    slug: body.slug,
                    name: body.name,
                    version: versionResult.rows[0],
                    message: 'Prompt created. Promote a version to an environment to make it available via the SDK.',
                });
                return [3 /*break*/, 11];
            case 8:
                err_5 = _c.sent();
                return [4 /*yield*/, client.query('ROLLBACK')];
            case 9:
                _c.sent();
                throw err_5;
            case 10:
                client.release();
                return [7 /*endfinally*/];
            case 11: return [3 /*break*/, 13];
            case 12:
                err_6 = _c.sent();
                next(err_6);
                return [3 /*break*/, 13];
            case 13: return [2 /*return*/];
        }
    });
}); });
// ── POST /v1/prompts/:slug/versions ───────────
// Add a new version to an existing prompt
exports.promptsRouter.post('/:slug/versions', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceId, slug, body, prompt_2, latestResult, latest, nextNum, nextVersion, result, err_7;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 4, , 5]);
                workspaceId = req.auth.workspaceId;
                slug = req.params.slug;
                body = UpdateVersionSchema.parse(req.body);
                return [4 /*yield*/, getPromptBySlug(workspaceId, slug)
                    // Get the latest version number and increment
                ];
            case 1:
                prompt_2 = _d.sent();
                return [4 /*yield*/, pool_1.db.query("SELECT version FROM prompt_versions\n       WHERE prompt_id = $1\n       ORDER BY created_at DESC LIMIT 1", [prompt_2.id])];
            case 2:
                latestResult = _d.sent();
                latest = (_b = (_a = latestResult.rows[0]) === null || _a === void 0 ? void 0 : _a.version) !== null && _b !== void 0 ? _b : 'v0';
                nextNum = parseInt(latest.replace('v', ''), 10) + 1;
                nextVersion = "v".concat(nextNum);
                return [4 /*yield*/, pool_1.db.query("INSERT INTO prompt_versions (prompt_id, version, messages, variables, review_notes, status)\n       VALUES ($1, $2, $3, $4, $5, 'draft')\n       RETURNING id, version, status, created_at", [prompt_2.id, nextVersion, JSON.stringify(body.messages), body.variables, (_c = body.review_notes) !== null && _c !== void 0 ? _c : null])];
            case 3:
                result = _d.sent();
                res.status(201).json({
                    promptSlug: slug,
                    version: result.rows[0],
                    message: "Version ".concat(nextVersion, " created as draft. Submit for review to promote it."),
                });
                return [3 /*break*/, 5];
            case 4:
                err_7 = _d.sent();
                next(err_7);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// ── POST /v1/prompts/:slug/promote ───────────
// Promote a version to an environment (e.g. production, staging)
exports.promptsRouter.post('/:slug/promote', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceId, slug, body, prompt_3, versionResult, version, err_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                workspaceId = req.auth.workspaceId;
                slug = req.params.slug;
                body = PromoteSchema.parse(req.body);
                return [4 /*yield*/, getPromptBySlug(workspaceId, slug)
                    // Verify the version exists and is approved
                ];
            case 1:
                prompt_3 = _a.sent();
                return [4 /*yield*/, pool_1.db.query("SELECT id, version, status FROM prompt_versions\n       WHERE id = $1 AND prompt_id = $2", [body.version_id, prompt_3.id])];
            case 2:
                versionResult = _a.sent();
                if (versionResult.rowCount === 0) {
                    throw new errors_1.NotFoundError('Prompt version');
                }
                version = versionResult.rows[0];
                if (version.status !== 'approved') {
                    throw new Error("Only approved versions can be promoted. This version is \"".concat(version.status, "\"."));
                }
                // Upsert the promotion (replace any existing promotion for this environment)
                return [4 /*yield*/, pool_1.db.query("INSERT INTO promotions (prompt_id, prompt_version_id, environment)\n       VALUES ($1, $2, $3)\n       ON CONFLICT (prompt_id, environment)\n       DO UPDATE SET prompt_version_id = $2, promoted_at = NOW()", [prompt_3.id, body.version_id, body.environment])];
            case 3:
                // Upsert the promotion (replace any existing promotion for this environment)
                _a.sent();
                res.json({
                    message: "Version ".concat(version.version, " is now live in \"").concat(body.environment, "\"."),
                    slug: slug,
                    version: version.version,
                    environment: body.environment,
                });
                return [3 /*break*/, 5];
            case 4:
                err_8 = _a.sent();
                next(err_8);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// ── PATCH /v1/prompts/:slug/versions/:versionId/status ───
// Approve or reject a version (reviewer action)
exports.promptsRouter.patch('/:slug/versions/:versionId/status', function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var workspaceId, _a, slug, versionId, _b, status_1, review_notes, prompt_4, result, err_9;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                workspaceId = req.auth.workspaceId;
                _a = req.params, slug = _a.slug, versionId = _a.versionId;
                _b = zod_1.z.object({
                    status: zod_1.z.enum(['approved', 'rejected', 'in_review']),
                    review_notes: zod_1.z.string().optional(),
                }).parse(req.body), status_1 = _b.status, review_notes = _b.review_notes;
                return [4 /*yield*/, getPromptBySlug(workspaceId, slug)];
            case 1:
                prompt_4 = _c.sent();
                return [4 /*yield*/, pool_1.db.query("UPDATE prompt_versions\n       SET status = $1,\n           review_notes = COALESCE($2, review_notes),\n           approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END\n       WHERE id = $3 AND prompt_id = $4\n       RETURNING id, version, status", [status_1, review_notes !== null && review_notes !== void 0 ? review_notes : null, versionId, prompt_4.id])];
            case 2:
                result = _c.sent();
                if (result.rowCount === 0) {
                    throw new errors_1.NotFoundError('Prompt version');
                }
                res.json({
                    message: "Version ".concat(result.rows[0].version, " is now \"").concat(status_1, "\"."),
                    version: result.rows[0],
                });
                return [3 /*break*/, 4];
            case 3:
                err_9 = _c.sent();
                next(err_9);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// ── Helpers ───────────────────────────────────
function getPromptBySlug(workspaceId, slug) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool_1.db.query('SELECT id, slug, name FROM prompts WHERE workspace_id = $1 AND slug = $2', [workspaceId, slug])];
                case 1:
                    result = _a.sent();
                    if (result.rowCount === 0)
                        throw new errors_1.NotFoundError("Prompt \"".concat(slug, "\""));
                    return [2 /*return*/, result.rows[0]];
            }
        });
    });
}
