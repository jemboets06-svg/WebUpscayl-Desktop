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
The application downloads the official Windows portable Real-ESRGAN NCNN/Vulkan package on first use:
https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip

The downloaded engine is stored in the user's local application data and reused on later runs.

## Build on GitHub
GitHub Actions workflow: .github/workflows/build-windows.yml

Run manually from the Actions tab. The workflow produces:
- WebUpscayl-Desktop-1.0.0-x64.exe
- WebUpscayl-Desktop-1.0.0-portable-x64.exe

No VS Code is required for end users. The final EXE installer is the intended distribution format.

## License
MIT for this application code. Real-ESRGAN remains third-party software under its upstream license.
