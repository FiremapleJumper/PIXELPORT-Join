# PixelPort sideways Wii Remote input core

This experimental core with software and OpenGL rendering adds one emulated sideways Wii Remote. It uses keyboard or browser gamepad input (including configurable 8BitDo layouts), plus generated shake and tilt. Nunchuk, IR pointer, original Wii Remote Bluetooth pairing, physical gyroscope input and Wii online rooms are not implemented. GameCube continues to use the separate original core.

## Source and license

The native changes are GPL-2.0-or-later, matching Dolphin. The complete build inputs are public:

- Browser port: https://github.com/dougchansan/wasm-dolphin at `7e38409ace3dda709c178312ff63fd92a3653cc7`.
- Dolphin: `e22551eae1c84a7e4d0b6a5c519ef4ed4ef69df1`, fetched by that port's source lock.
- Its 66 locked browser patches: set SHA-256 `8e3a1b6101a233488aaedd1dbfc912dda4312423ea7ae44bf8d1df9bf8056d0f`, resulting vendor tree `dd6f5548aa13de585ec9988130f98aa9d0ce1982`.
- `core-input.patch` and `pixelport_wiimote_input.h` here supply PixelPort's native changes.
- `configure-pixelport-linux.mjs` provides a separate Linux build profile without the WebGPU shader translator. It preserves the original Windows build profile and records its actual Linux tool versions and hashes. It adds the input bridge ABI export to the patched vendor CMake target.

## Build on Linux

Use Emscripten SDK 5.0.7 (compiler `263db4cffa6f9fc2ec514a70abac81362ea41849`), CMake 4.3.2, Ninja 1.13.2, Git, Python 3 and Node.js. Install Emscripten from https://github.com/emscripten-core/emsdk. Set `EMSDK` to its installation directory, `EM_CONFIG` to its generated `.emscripten` configuration, and `CMAKE` / `NINJA` to the executables.

1. Clone the browser port and check out the pinned commit above.
2. Run `node tools/fetch-dolphin.mjs`, then `node tools/patch-upstream-wasm.mjs`. These validate the upstream source and patch series.
3. Apply `core-input.patch` from this directory at the browser-port root with `git apply`.
4. Copy `pixelport_wiimote_input.h` to `core/upstream/` and `configure-pixelport-linux.mjs` to `tools/` in that checkout.
5. Set `DOLPHIN_WASM_BUILD_DIR` and `DOLPHIN_WASM_OUTPUT_DIR` to separate absolute build/output directories. Run `node tools/configure-pixelport-linux.mjs`.
6. Run CMake with `--build` pointing at that build directory, `--target dolphin_web_core`, and a suitable `--parallel` limit.

The Linux profile deliberately does not compile the Rust/Naga experimental WebGPU hardware shader translator. Its explicit C stub rejects that WebGPU hardware route. The compiled OpenGL backend remains available and uses WebGL 2 in the browser; Wii settings allow OpenGL GPU or software rendering. The older `softwareOnly` build-record field describes the original deployment profile, not removal of the OpenGL backend. WebGPU can still present the software-rendered image. The original GameCube renderer is unaffected.

## Checks

Run `node --test native/wii/controller.test.mjs`. Compile `test-input.cpp` with a C++20 host compiler and run the result. Run `node native/wii/wasm-smoke.mjs /absolute/output/dolphin-core-upstream.js` to verify the compiled module initializes an emulated Wii Remote and that button presses, rotated D-pad input and release reach Dolphin. Pass `OGL` as a third argument to the WASM smoke script to check Wii input with OpenGL selected. This checks native initialization and input, not rendered gameplay or performance. The browser validates the full Wii WASM SHA-256 and checks `PixelPortWiiInputVersion()` before accepting it; it will report an error instead of falling back to a core without Wii Remote input.

Successful compilation and input tests are not proof of gameplay compatibility. No Nintendo games are bundled. Test gameplay with your own game image and keep backups of saves.
