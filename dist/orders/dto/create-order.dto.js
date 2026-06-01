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
exports.CreateOrderDto = exports.PriceDto = exports.DocumentDto = exports.CustomerDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class CustomerDto {
    name;
    phone;
    dateOfBirth;
    address;
}
exports.CustomerDto = CustomerDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(3),
    __metadata("design:type", String)
], CustomerDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.Matches)(/^[6-9]\d{9}$/, {
        message: 'phone must be a valid 10-digit Indian mobile number starting with 6–9',
    }),
    __metadata("design:type", String)
], CustomerDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsDateString)({}, { message: 'dateOfBirth must be a valid ISO 8601 date (e.g. 1990-05-15)' }),
    __metadata("design:type", String)
], CustomerDto.prototype, "dateOfBirth", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    __metadata("design:type", String)
], CustomerDto.prototype, "address", void 0);
class DocumentDto {
    name;
    url;
    publicId;
    label;
    originalName;
    resourceType;
    format;
    bytes;
}
exports.DocumentDto = DocumentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DocumentDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsUrl)({ protocols: ['https'], require_protocol: true }, {
        message: 'url must be a valid HTTPS URL',
    }),
    __metadata("design:type", String)
], DocumentDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DocumentDto.prototype, "publicId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DocumentDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DocumentDto.prototype, "originalName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DocumentDto.prototype, "resourceType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DocumentDto.prototype, "format", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], DocumentDto.prototype, "bytes", void 0);
class PriceDto {
    governmentFee;
    serviceCharge;
    documentHandling;
    total;
}
exports.PriceDto = PriceDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], PriceDto.prototype, "governmentFee", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], PriceDto.prototype, "serviceCharge", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], PriceDto.prototype, "documentHandling", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], PriceDto.prototype, "total", void 0);
class CreateOrderDto {
    serviceType;
    customer;
    documents;
    price;
}
exports.CreateOrderDto = CreateOrderDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "serviceType", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CustomerDto),
    __metadata("design:type", CustomerDto)
], CreateOrderDto.prototype, "customer", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DocumentDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateOrderDto.prototype, "documents", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PriceDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", PriceDto)
], CreateOrderDto.prototype, "price", void 0);
//# sourceMappingURL=create-order.dto.js.map