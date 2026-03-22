"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenError = exports.ConflictError = exports.NotFoundError = exports.AppError = void 0;
exports.errorHandler = errorHandler;
var zod_1 = require("zod");
function errorHandler(err, _req, res, _next) {
    // Zod validation errors
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Invalid request data.',
            details: err.errors.map(function (e) { return ({
                field: e.path.join('.'),
                message: e.message,
            }); }),
        });
        return;
    }
    // Known operational errors
    if (err instanceof AppError) {
        res.status(err.status).json({
            error: err.code,
            message: err.message,
        });
        return;
    }
    // Unknown errors
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
    });
}
var AppError = /** @class */ (function (_super) {
    __extends(AppError, _super);
    function AppError(code, message, status) {
        if (status === void 0) { status = 400; }
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.status = status;
        _this.name = 'AppError';
        return _this;
    }
    return AppError;
}(Error));
exports.AppError = AppError;
var NotFoundError = /** @class */ (function (_super) {
    __extends(NotFoundError, _super);
    function NotFoundError(resource) {
        return _super.call(this, 'NOT_FOUND', "".concat(resource, " not found."), 404) || this;
    }
    return NotFoundError;
}(AppError));
exports.NotFoundError = NotFoundError;
var ConflictError = /** @class */ (function (_super) {
    __extends(ConflictError, _super);
    function ConflictError(message) {
        return _super.call(this, 'CONFLICT', message, 409) || this;
    }
    return ConflictError;
}(AppError));
exports.ConflictError = ConflictError;
var ForbiddenError = /** @class */ (function (_super) {
    __extends(ForbiddenError, _super);
    function ForbiddenError(message) {
        if (message === void 0) { message = 'You do not have permission to perform this action.'; }
        return _super.call(this, 'FORBIDDEN', message, 403) || this;
    }
    return ForbiddenError;
}(AppError));
exports.ForbiddenError = ForbiddenError;
