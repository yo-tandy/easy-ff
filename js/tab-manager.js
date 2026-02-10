import { DOM_ELEMENTS } from './constants.js';
import { createElementFromHTML } from './utils.js';

export class TabManager {
    constructor(sceneManager, commandGenerator) {
        this.tabCount = 0;
        this.activeTab = null;
        this.sceneManager = sceneManager;
        this.commandGenerator = commandGenerator;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.addTab('Clip 1'); // Initialize with first tab
    }

    setupEventListeners() {
        // Add tab button in the UI should call this.addTab()
        // This will be handled by the main app
    }

    addTab(name) {
        this.tabCount++;
        const tabId = `clip-${this.tabCount}`;
        const tabs = document.querySelector(DOM_ELEMENTS.tabs);

        // Create tab button
        const btnHtml = `
            <button class="tab-button" id="tabbtn-${tabId}">
                <span>${name || `Clip ${this.tabCount}`}</span>
                <span class="tab-close">×</span>
            </button>
        `;
        const btn = createElementFromHTML(btnHtml);
        
        // Setup event listeners for the tab button
        btn.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.setActiveTab(tabId);
            }
        });

        btn.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeTab(tabId);
        });

        tabs.appendChild(btn);

        // Create tab content
        const contentHtml = `
            <div class="tab-content" id="${tabId}">
                <div class="scenes"></div>
                <button class="add-scene-btn">+ Add Scene</button>
                <div style="margin-top: 20px;">
                    <div class="command-header">
                        <h3>Generated Command</h3>
                        <button class="copy-btn" title="Copy to clipboard">📋</button>
                    </div>
                    <textarea id="output-${tabId}" readonly></textarea>
                </div>
            </div>
        `;
        const content = createElementFromHTML(contentHtml);
        
        // Setup event listeners for tab content
        content.querySelector('.add-scene-btn').addEventListener('click', () => {
            this.sceneManager.addScene(tabId);
        });

        content.querySelector('.copy-btn').addEventListener('click', () => {
            this.commandGenerator.copyCommand(tabId);
        });

        document.querySelector(DOM_ELEMENTS.tabsContent).appendChild(content);

        // Initialize validation for any inputs in the new tab content
        if (window.ffmpegApp && window.ffmpegApp.validationSetup) {
            window.ffmpegApp.validationSetup.initializeContainerValidation(content);
        }

        this.setActiveTab(tabId);

        // Create initial scene with start time from previous clip's last scene
        let initialStart = 0;
        const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
        const currentTabIndex = tabButtons.findIndex(btn => btn.id === `tabbtn-${tabId}`);
        if (currentTabIndex > 0) {
            const prevTabId = tabButtons[currentTabIndex - 1].id.replace('tabbtn-', '');
            const prevClipScenes = document.querySelectorAll(`#${prevTabId} .scene`);
            if (prevClipScenes.length > 0) {
                const lastScene = prevClipScenes[prevClipScenes.length - 1];
                initialStart = parseFloat(lastScene.querySelector('.end')?.value) || 0;
            }
        }
        
        this.sceneManager.addScene(tabId, initialStart);

        return tabId;
    }

    setActiveTab(tabId) {
        if (this.activeTab) {
            document.getElementById(`tabbtn-${this.activeTab}`)?.classList.remove('active');
            document.getElementById(this.activeTab)?.classList.remove('active');
        }
        
        this.activeTab = tabId;
        document.getElementById(`tabbtn-${tabId}`)?.classList.add('active');
        document.getElementById(tabId)?.classList.add('active');
    }

    removeTab(tabId) {
        document.getElementById(`tabbtn-${tabId}`)?.remove();
        document.getElementById(tabId)?.remove();
        
        const remaining = document.querySelectorAll('.tab-button');
        if (remaining.length > 0) {
            const firstId = remaining[0].id.replace('tabbtn-', '');
            this.setActiveTab(firstId);
        } else {
            this.addTab();
        }
        
        this.sceneManager.validateAllTabs();
    }

    getActiveTab() {
        return this.activeTab;
    }

    getAllTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        return Array.from(tabButtons).map(btn => {
            const tabId = btn.id.replace('tabbtn-', '');
            const clipName = btn.querySelector('span')?.textContent || tabId;
            return { id: tabId, name: clipName };
        });
    }

    loadTabsFromData(clipsData) {
        // Clear existing tabs
        document.querySelector(DOM_ELEMENTS.tabs).innerHTML = '';
        document.querySelector(DOM_ELEMENTS.tabsContent).innerHTML = '';
        this.tabCount = 0;
        this.activeTab = null;

        // Create clips and scenes from data
        clipsData.forEach(clipData => {
            this.tabCount++;
            const tabId = `clip-${this.tabCount}`;
            const tabs = document.querySelector(DOM_ELEMENTS.tabs);

            const btnHtml = `
                <button class="tab-button" id="tabbtn-${tabId}">
                    <span>${clipData.name || `Clip ${this.tabCount}`}</span>
                    <span class="tab-close">×</span>
                </button>
            `;
            const btn = createElementFromHTML(btnHtml);
            
            btn.addEventListener('click', (e) => {
                if (!e.target.classList.contains('tab-close')) {
                    this.setActiveTab(tabId);
                }
            });

            btn.querySelector('.tab-close').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeTab(tabId);
            });

            tabs.appendChild(btn);

            const contentHtml = `
                <div class="tab-content" id="${tabId}">
                    <div class="scenes"></div>
                    <button class="add-scene-btn">+ Add Scene</button>
                    <div style="margin-top: 20px;">
                        <div class="command-header">
                            <h3>Generated Command</h3>
                            <button class="copy-btn" title="Copy to clipboard">📋</button>
                        </div>
                        <textarea id="output-${tabId}" readonly></textarea>
                    </div>
                </div>
            `;
            const content = createElementFromHTML(contentHtml);
            
            content.querySelector('.add-scene-btn').addEventListener('click', () => {
                this.sceneManager.addScene(tabId);
            });

            content.querySelector('.copy-btn').addEventListener('click', () => {
                this.commandGenerator.copyCommand(tabId);
            });

            document.querySelector(DOM_ELEMENTS.tabsContent).appendChild(content);

            // Add scenes
            clipData.scenes.forEach(sceneData => {
                const container = document.querySelector(`#${tabId} .scenes`);
                const div = this.sceneManager.createSceneElement(tabId, sceneData);
                container.appendChild(div);
            });

            this.setActiveTab(tabId);
            this.commandGenerator.updateCommand(tabId);
            this.sceneManager.recalcClipStarts(tabId);
        });

        // Activate first tab
        const firstBtn = document.querySelector('.tab-button');
        if (firstBtn) {
            const firstId = firstBtn.id.replace('tabbtn-', '');
            this.setActiveTab(firstId);
        }
        
        this.sceneManager.validateAllTabs();
    }
}