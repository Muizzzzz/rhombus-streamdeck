"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenCamera = void 0;
// src/actions/open-camera.ts
const streamdeck_1 = require("@elgato/streamdeck");
const child_process_1 = require("child_process");
let OpenCamera = class OpenCamera extends streamdeck_1.SingletonAction {
    onDidReceiveSettings(e) {
        this.logger.info("Settings loaded:", e.payload.settings);
    }
    onKeyDown(e) {
        const { apiKey, cameraUuid } = e.settings;
        if (!apiKey || !cameraUuid) {
            this.logger.warn("API key or camera not set");
            return;
        }
        (0, child_process_1.exec)(`/Users/muizzkhan/.streamdeck/play_cam.sh ${cameraUuid}`);
    }
};
exports.OpenCamera = OpenCamera;
exports.OpenCamera = OpenCamera = __decorate([
    (0, streamdeck_1.action)({ UUID: "com.muizz.rhombus-camera.action" })
], OpenCamera);
