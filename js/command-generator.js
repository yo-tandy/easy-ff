import { DOM_ELEMENTS, PAN_METHODS } from './constants.js';
import { parseDimensions, sanitizeFilename, copyToClipboard } from './utils.js';

export class CommandGenerator {
    constructor() {
        // No initialization needed for now
    }

    updateCommand(tabId) {
        const inputName = document.querySelector(DOM_ELEMENTS.inputName).value;
        const [inW, inH] = parseDimensions(document.querySelector(DOM_ELEMENTS.inDim).value);
        const [outW, outH] = parseDimensions(document.querySelector(DOM_ELEMENTS.outDim).value);
        const ratio = Math.min(inH/outH, inW/outW);
        const cropH = ratio * outH;
        const cropW = ratio * outW;

        const scenes = document.querySelectorAll(`#${tabId} .scene`);
        let filters = "";
        let concatStr = "";

        scenes.forEach((scene, index) => {
            const s = scene.querySelector('.start').value;
            const e = scene.querySelector('.end').value;
            const duration = (e - s).toFixed(2);
            const cropPct = scene.querySelector('.hCrop').value / 100;
            const isPan = scene.querySelector('.panToggle').checked;
            
            let xExpr;
            if (!isPan) {
                xExpr = `(in_w-${cropW})*${cropPct}`;
            } else {
                const cropPctEnd = scene.querySelector('.hCropEnd').value / 100;
                const method = scene.querySelector('.panMethod').value;
                const startX = `(in_w-${cropW})*${cropPct}`;
                const endX = `(in_w-${cropW})*${cropPctEnd}`;
                
                if (method === PAN_METHODS.LINEAR) {
                    xExpr = `${startX}+(${endX}-(${startX}))*(t/${duration})`;
                } else {
                    xExpr = `${startX}+(${endX}-(${startX}))*(1-cos(PI*t/${duration}))/2`;
                }
            }
            
            filters += `[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS,crop=${cropW}:${cropH}:${xExpr}:0,scale=${outW}:${outH}[v${index}]; `;
            filters += `[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${index}]; `;
            concatStr += `[v${index}][a${index}]`;
        });

        const outputEl = document.getElementById(`output-${tabId}`);
        if (scenes.length > 0) {
            const clipName = document.querySelector(`#tabbtn-${tabId} span`)?.textContent || 'output';
            const safeClipName = sanitizeFilename(clipName);
            const finalCmd = `ffmpeg -i ${inputName} -filter_complex \\
"${filters}${concatStr}concat=n=${scenes.length}:v=1:a=1[v][a]" \\
-map "[v]" -map "[a]" -c:v libx264 -c:a aac ${safeClipName}.mp4`;
            outputEl.value = finalCmd;
        } else {
            outputEl.value = "Add a scene to generate command...";
        }
    }

    copySceneCommand(tabId, sceneEl) {
        const inputName = document.querySelector(DOM_ELEMENTS.inputName).value;
        const [inW, inH] = parseDimensions(document.querySelector(DOM_ELEMENTS.inDim).value);
        const [outW, outH] = parseDimensions(document.querySelector(DOM_ELEMENTS.outDim).value);
        const ratio = Math.min(inH/outH, inW/outW);
        const cropH = ratio * outH;
        const cropW = ratio * outW;

        const scenes = Array.from(document.querySelectorAll(`#${tabId} .scene`));
        const sceneIndex = scenes.indexOf(sceneEl) + 1;

        const s = sceneEl.querySelector('.start').value;
        const e = sceneEl.querySelector('.end').value;
        const duration = (e - s).toFixed(2);
        const cropPct = sceneEl.querySelector('.hCrop').value / 100;
        const isPan = sceneEl.querySelector('.panToggle').checked;
        
        let xExpr;
        if (!isPan) {
            xExpr = `(in_w-${cropW})*${cropPct}`;
        } else {
            const cropPctEnd = sceneEl.querySelector('.hCropEnd').value / 100;
            const method = sceneEl.querySelector('.panMethod').value;
            const startX = `(in_w-${cropW})*${cropPct}`;
            const endX = `(in_w-${cropW})*${cropPctEnd}`;
            
            if (method === PAN_METHODS.LINEAR) {
                xExpr = `${startX}+(${endX}-(${startX}))*(t/${duration})`;
            } else {
                xExpr = `${startX}+(${endX}-(${startX}))*(1-cos(PI*t/${duration}))/2`;
            }
        }

        const clipName = document.querySelector(`#tabbtn-${tabId} span`)?.textContent || 'output';
        const safeClipName = sanitizeFilename(clipName);
        const outputName = `${safeClipName}-${sceneIndex}.mp4`;

        const cmd = `ffmpeg -i ${inputName} -filter_complex \\
"[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS,crop=${cropW}:${cropH}:${xExpr}:0,scale=${outW}:${outH}[v]; [0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a]" \\
-map "[v]" -map "[a]" -c:v libx264 -c:a aac ${outputName}`;

        copyToClipboard(cmd).then(() => {
            const btn = sceneEl.querySelector('.scene-copy-btn');
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = '✓';
                setTimeout(() => btn.textContent = orig, 1000);
            }
        });
    }

    copyCommand(tabId) {
        const outputEl = document.getElementById(`output-${tabId}`);
        if (outputEl && outputEl.value) {
            copyToClipboard(outputEl.value).then(() => {
                const btn = document.querySelector(`#${tabId} .copy-btn`);
                if (btn) {
                    btn.textContent = '✓';
                    setTimeout(() => { btn.textContent = '📋'; }, 1500);
                }
            });
        }
    }

    downloadScript() {
        let script = '#!/bin/bash\n\n';
        const tabButtons = document.querySelectorAll('.tab-button');
        
        tabButtons.forEach(btn => {
            const tabId = btn.id.replace('tabbtn-', '');
            const outputEl = document.getElementById(`output-${tabId}`);
            if (outputEl && outputEl.value && !outputEl.value.includes('Add a scene')) {
                const clipName = btn.querySelector('span')?.textContent || tabId;
                script += `# ${clipName}\n`;
                script += outputEl.value + '\n\n';
            }
        });

        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ffmpeg-commands.sh';
        a.click();
        URL.revokeObjectURL(url);
    }
}