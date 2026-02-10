// Constants and configuration
export const DEFAULTS = {
    MAX_VIDEO_WIDTH: 800,
    DEFAULT_FRAME_RATE: 30,
    CONTINUITY_EPSILON: 0.05,
    DEFAULT_SCENE_LENGTH: 5,
    INPUT_FILE: 'input.mkv',
    INPUT_DIMENSIONS: '1280x640',
    OUTPUT_DIMENSIONS: '720x1280'
};

export const DOM_ELEMENTS = {
    inputName: '#inputName',
    inDim: '#inDim',
    outDim: '#outDim',
    videoFile: '#videoFile',
    videoInfo: '#videoInfo',
    videoContainer: '#videoContainer',
    previewVideo: '#previewVideo',
    cropOverlay: '#cropOverlay',
    cropWindow: '#cropWindow',
    cropWindowEnd: '#cropWindowEnd',
    videoSeek: '#videoSeek',
    videoControls: '#videoControls',
    sceneActions: '#sceneActions',
    timeDisplay: '#timeDisplay',
    cropDisplay: '#cropDisplay',
    cropDisplayEnd: '#cropDisplayEnd',
    playPauseBtn: '#playPauseBtn',
    panToggleBtn: '#panToggleBtn',
    setEndCropBtn: '#setEndCropBtn',
    tabs: '#tabs',
    tabsContent: '#tabsContent'
};

export const PAN_METHODS = {
    LINEAR: 'linear',
    ZOOM: 'zoom'
};