# WebUpscayl Desktop

Desktop Windows 64-bit batch AI image upscaler, designed around the workflow of Upscayl while using the official Real-ESRGAN NCNN/Vulkan portable engine.

## Features
- Windows desktop application.
- Select an input folder and scan nested folders.
- Batch queue with select-all/remove controls.
- Real-ESRGAN photo model.
- Real-ESRGAN anime model.
- 2x / 4x output scale.
- PNG / JPEG / WebP output.
- Custom output prefix.
- GPU tile setting for lower VRAM systems.
- Automatic output saving, preserving input subfolders.
- First-run engine download with progress.
- Cancel running batch.
- NSIS installer and portable EXE.

## Supported input
The bundled Real-ESRGAN NCNN/Vulkan executable accepts JPG, PNG and WebP input.

## AI engine
The Windows installer now bundles the official Real-ESRGAN NCNN/Vulkan Windows engine, so the installed application is ready to use without a first-run engine download. A fallback download is retained for development builds.

Source engine: https://github.com/xinntao/Real-ESRGAN/releases/tag/v0.2.5.0

## Build on GitHub
GitHub Actions workflow: .github/workflows/build-windows.yml

Run manually from the Actions tab. The workflow produces:
- WebUpscayl-Desktop-1.0.1-x64.exe
- WebUpscayl-Desktop-1.0.0-portable-x64.exe

No VS Code is required for end users. The final EXE installer is the intended distribution format.

## License
MIT for this application code. Real-ESRGAN remains third-party software under its upstream license.

## Scaling behavior

For general photos, 4x uses `realesrgan-x4plus`. The 2x workflow uses the same NCNN x4plus model with `-s 2`, matching the way Upscayl invokes its NCNN backend; the official NCNN executable's bundled model list does not include `RealESRGAN_x2plus`. The separate `RealESRGAN_x2plus` model exists in the main Real-ESRGAN project, but is not a built-in model of the official 0.2.5.0 NCNN Windows package.
