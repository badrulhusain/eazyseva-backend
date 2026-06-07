"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateOrderStatusDto = void 0;
const class_validator_1 = require("class-validator");
const ORDER_STATUS_VALUES = [
    'PENDING',
    'UNDER_REVIEW',
    'ACCEPTED',
    'CORRECTION_REQUESTED',
    'PROCESSING',
    'COMPLETED',
    'REJECTED',
    'CANCELLED',
];
class UpdateOrderStatusDto {
    status;
    reason;
    adminNote;
}
exports.UpdateOrderStatusDto = UpdateOrderStatusDto;
__decorate([
    (0, class_validator_1.IsEnum)(ORDER_STATUS_VALUES, {
        message: `status must be one of: ${ORDER_STATUS_VALUES.join(', ')}`,
    }),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.status === 'REJECTED' || o.status === 'CORRECTION_REQUESTED'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({
        message: 'reason is required when rejecting an order or requesting a correction',
    }),
    (0, class_validator_1.MaxLength)(500, { message: 'reason must not exceed 500 characters' }),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000, { message: 'adminNote must not exceed 1000 characters' }),
    __metadata("design:type", String)
], UpdateOrderStatusDto.prototype, "adminNote", void 0);
//# sourceMappingURL=update-order-status.dto.js.map