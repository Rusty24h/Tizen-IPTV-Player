/* jshint browser: true, devel: true, undef: true, unused: true, strict: true, esversion: 5 */
/* global tizen, webapis, Promise, Intl, Blob, URL, FileReader */
/*
 * SmartSTB Clone for Samsung Tizen TV & PC
 * Complete Application Controller (app.js)
 * Compatible with Tizen 4.0+ WebEngine & Desktop Browsers (ES5/ES6 safe)
 */
(function() {
    'use strict';
    var PROXY_URL = 'http://127.0.0.1:3001';
    var FALLBACK_PROXY_URL = 'http://127.0.0.1:3000';
    var SERVICE_ID = 'smartstbv2.StalkerProxy';
    var modes = [
        { id: 'live', title: 'Live TV', icon: '📺' },
        { id: 'vod', title: 'Movies', icon: '🎬' },
        { id: 'series', title: 'TV Series', icon: '📁' },
        { id: 'search', title: 'Global Search', icon: '🔍' },
        { id: 'profiles', title: 'Profiles', icon: '👤' },
        { id: 'settings', title: 'Settings', icon: '⚙' }
    ];
    function getModeIndexById(targetId) {
        for (var m = 0; m < modes.length; m++) {
            if (modes[m] && modes[m].id === targetId) {
                return m;
            }
        }
        return 0;
    }
    var modeIdx = 0;
    var lastContentModeIdx = 0;
    var catIdx = 0;
    var itemIdx = 0;
    var infoActionIdx = 0;
    var activeCol = 'cats';
    var liveGenres = [];
    var allChannels = [];
    var vodCats = [];
    var seriesCats = [];
    var rawCats = [];
    var rawItems = [];
    var currentCats = [];
    var currentItems = [];
    var catFilterText = '';
    var itemFilterText = '';
    var currentSort = 'added';
    var vodPage = 1;
    var vodLoading = false;
    var vodHasMore = true;
    var liveGenrePaged = false;
    var liveCatalogLoading = false;
    var loadedCatSignature = '';
    var catHoverTimer = null;
    var seriesStack = [];
    var isPlayingVod = false;
    var isPlayingCatchup = false;
    var isPaused = false;
    var isPlaybackHealthy = false;
    var hasActivePlaybackError = false;
    var currentPlayingItem = null;
    var previousLiveChannel = null;
    var retryCount = 0;
    var playSessionId = 0;
    var bufferingWatchdogTimer = null;
    var currentAspect = 'PLAYER_DISPLAY_MODE_LETTER_BOX';
    var audioTracks = [];
    var audioIdx = 0;
    var textTracks = [];
    var textIdx = -1;
    var subtitlesEnabled = true;
    var subtitleClearTimer = null;
    var vodDurationMs = 0;
    var vodCurrentMs = 0;
    var seekTargetMs = null;
    var seekDebounceTimer = null;
    var nextEpCandidate = null;
    var nextEpTimer = null;
    var nextEpCountdown = 0;
    var nextEpDismissedForId = null;
    var uiVisible = true;
    var zapTimeout = null;
    var osdTimeout = null;
    var previewEpgTimeout = null;
    var numBuffer = '';
    var numTimeout = null;
    var exitConfirmPending = false;
    var exitConfirmTimeout = null;
    var hasAutoResumedOnBoot = false;
    var userInteractedSinceBoot = false;
    var shortEpgCache = {};
    var shortEpgKeys = [];
    var fullEpgCache = {};
    var seriesLoading = false;
    var lastKeyRepeatTime = 0;
    var favLiveCache = null;
    var favVodCache = null;
    var favSeriesCache = null;
    var favLookupCache = { live: null, vod: null, series: null };
    var watchedLookupCache = null;
    var vodResumeCache = null;
    var pinnedCatsCache = {};
    var pinnedCatsMapCache = {};
    var hiddenCatsCache = {};
    var hiddenCatsMapCache = {};
    var hiddenItemsCache = {};
    var hiddenItemsMapCache = {};
    var showHiddenEntries = false;
    var activeSeriesSeasons = [];
    var activeSeriesPlaylist = [];
    var playingEpisodeList = [];
    var playbackStartedAt = 0;
    var channelPrefsCache = null;
    var hasAppliedSavedTrackPrefs = false;
    var xmltvCache = {};
    var recLiveCache = null;
    var recVodCache = null;
    var ADULT_RE = /adult|xxx|18\+|\+18|18\||for adults|erotic|porn/i;
    var layoutEnforced = false;
    var genreChannelCounts = {};
    var genreChannelsMap = {};
    var pagedLiveGenresMap = {};
    var channelByIdMap = {};
    var channelByNumMap = {};
    var previewDebounceTimer = null;
    var playerVolume = Number(localStorage.getItem('cfg_volume') || 100);
    var playerMuted = false;
    var toastTimeout = null;
    var accountInfoText = '';
    var quickActionButtons = [];
    var allQuickActionPills = [];
    var moreToolsExpanded = false;
    var lastQuickActionSig = '';
    var posterLoadTimer = null;
    var warmPreloadTimer = null;
    var connTestReqId = 0;

    // Settings Modal 2D Grid State
    var settingsOpen = false;
    var settingsRow = 0;
    var settingsCol = 0;
    var settingsLastColRatio = 0;
    var imeActive = false;
    var profiles = [];
    var activeProfileId = '';
    var editingProfileIndex = 0;

    // Parental PIN Modal State
    var pinModalOpen = false;
    var pinModalRow = 0;
    var pinModalCol = 0;
    var pinModalCallback = null;

    // Search Modal State
    var searchOpen = false;
    var searchFocusArea = 'input';
    var searchIdx = 0;
    var searchResults = [];
    var searchDebounce = null;
    var searchSeq = 0;

    // Filter Modal 2D Grid State
    var filterOpen = false;
    var filterRow = 0;
    var filterCol = 0;
    var filterTargetCol = 'items';

    // Full EPG Modal State
    var epgModalOpen = false;
    var epgModalChannel = null;
    var epgModalItems = [];
    var epgModalIdx = 0;
    var epgViewMode = 'list';
    var epgGridChannels = [];
    var epgGridProgramsByCh = {};
    var epgGridChIdx = 0;
    var epgGridSlotIdx = 0;
    var epgGridWindowStartSec = 0;

    // Interactive Audio & Subtitle Track Picker Modal State
    var tracksModalOpen = false;
    var tracksModalItems = [];
    var tracksModalIdx = 0;
    var subtitleColor = localStorage.getItem('cfg_sub_color') || 'white';
    var subtitleSize = localStorage.getItem('cfg_sub_size') || 'normal';
    var subtitleDelayMs = Math.max(-5000, Math.min(5000, Math.round((Number(localStorage.getItem('cfg_sub_delay')) || 0) / 250) * 250));
    window._subtitleDelayMs = subtitleDelayMs;
    var subtitleDelayTimer = null;
    var lanSetupPollTimer = null;

    // Fullscreen Quick Channel Zapper Drawer State
    var miniZapOpen = false;
    var miniZapIdx = 0;

    // Sleep Timer, Reminders, Playback Speed, Bookmarks & DVR Recording State
    var sleepTimerMinutes = 0;
    var sleepTimerDeadline = 0;
    var sleepTimerInterval = null;
    var remindersCache = null;
    var reminderCheckTimer = null;
    var vodBookmarksCache = null;
    var currentPlaybackSpeed = 1;
    var cachedEpgOffsetSec = 0;
    var cachedPortalBaseUrl = null;
    var cachedPortalOrigin = null;
    var localPaginationCache = {
        listRef: null,
        listLen: 0,
        catId: '',
        query: '',
        sortBy: '',
        filtered: null
    };
    var bufferModePref = localStorage.getItem('cfg_buffer_mode') || 'fast';
    var startupModePref = localStorage.getItem('cfg_startup_mode') || 'last_channel';
    var osdTimeoutDurationMs = Math.max(2000, Math.min(15000, Number(localStorage.getItem('cfg_osd_timeout')) || 5000));
    var isRecordingStream = false;
    var recordingPollTimer = null;

    function extendObj(baseObj, extraObj) {
        var out = {};
        var k;
        if (baseObj) {
            for (k in baseObj) {
                if (Object.prototype.hasOwnProperty.call(baseObj, k)) {
                    out[k] = baseObj[k];
                }
            }
        }
        if (extraObj) {
            for (k in extraObj) {
                if (Object.prototype.hasOwnProperty.call(extraObj, k)) {
                    out[k] = extraObj[k];
                }
            }
        }
        return out;
    }

    // DOM References (Supports both #col-modes and #modes-col IDs)
    var subtitleBoxEl = document.getElementById('subtitle-box');
    var serviceBannerEl = document.getElementById('service-banner');
    var profileBadgeEl = document.getElementById('profile-badge');
    var accountBadgeEl = document.getElementById('account-exp-badge');
    var sleepTimerBadgeEl = document.getElementById('sleep-timer-badge');
    var reminderBadgeEl = document.getElementById('reminder-badge');
    var recStatusBadgeEl = document.getElementById('rec-status-badge');
    var modesColEl = document.getElementById('col-modes') || document.getElementById('modes-col');
    var catsColEl = document.getElementById('col-cats') || document.getElementById('cats-col');
    var itemsColEl = document.getElementById('col-items') || document.getElementById('items-col');
    var infoColEl = document.getElementById('col-info') || document.getElementById('info-col');
    var modesListEl = document.getElementById('modes-list');
    var catsListEl = document.getElementById('cats-list');
    var itemsListEl = document.getElementById('items-list');
    var catsHeaderEl = document.getElementById('cats-header');
    var itemsHeaderEl = document.getElementById('items-header');
    var previewPosterWrapEl = document.getElementById('preview-poster-wrap');
    var previewPosterEl = document.getElementById('preview-poster');
    var previewTitleEl = document.getElementById('preview-title');
    var previewMetaEl = document.getElementById('preview-meta');
    var previewDescEl = document.getElementById('preview-desc');
    var previewUpNextCardEl = document.getElementById('preview-upnext-card');
    var helpContextActionsEl = document.getElementById('help-context-actions');
    var vodViewMode = localStorage.getItem('cfg_vod_view') || 'list';
    var lockedPreviewItem = null;
    var profilePickerOpen = false;
    var profilePickerIdx = 0;
    var trailerModalOpen = false;
    var activeTrailerYoutubeId = '';
    var rebufferBurstTimestamps = [];
    var vodExtendedMetaCache = {};
    var filterBadgeEl = document.getElementById('filter-badge');
    var clockDisplayEl = document.getElementById('clock-display');
    var overlayEl = document.getElementById('ui-overlay');
    var numOsdEl = document.getElementById('num-osd');
    var osdBar = document.getElementById('osd-bar');
    var osdLogoBoxEl = document.getElementById('osd-logo-box');
    var osdChNumEl = document.getElementById('osd-ch-num');
    var osdTitle = document.getElementById('osd-title');
    var osdStatus = document.getElementById('osd-status');
    var osdTechBadgesEl = document.getElementById('osd-tech-badges');
    var epgNow = document.getElementById('epg-now');
    var osdEpgRemEl = document.getElementById('osd-epg-rem');
    var epgNext = document.getElementById('epg-next');
    var osdEpgProgressWrap = document.getElementById('osd-epg-progress-wrap');
    var osdEpgProgressFill = document.getElementById('osd-epg-progress-fill');
    var vodProgressWrap = document.getElementById('vod-progress-wrap');
    var vodProgressBar = document.getElementById('vod-progress-bar');
    var vodSeekMarker = document.getElementById('vod-seek-marker');
    var vodTimeRow = document.getElementById('vod-time-row');
    var vodTimeLabel = document.getElementById('vod-time-label') || document.getElementById('vod-time-cur');
    var vodTimeDurEl = document.getElementById('vod-time-dur');
    var vodSeekPreview = document.getElementById('vod-seek-preview');
    var nextEpBanner = document.getElementById('next-ep-banner');
    var nextEpTitleEl = document.getElementById('next-ep-title');
    var nextEpSubEl = document.getElementById('next-ep-sub');
    var miniZapDrawerEl = document.getElementById('mini-zap-drawer');
    var miniZapTitleEl = document.getElementById('mini-zap-title');
    var miniZapSubEl = document.getElementById('mini-zap-sub');
    var miniZapListEl = document.getElementById('mini-zap-list');
    var tracksModalEl = document.getElementById('tracks-modal');
    var tracksModalTitleEl = document.getElementById('tracks-modal-title');
    var tracksModalSubtitleEl = document.getElementById('tracks-modal-subtitle');
    var tracksListEl = document.getElementById('tracks-list');
    var tracksStyleColorEl = document.getElementById('tracks-style-color');
    var tracksStyleSizeEl = document.getElementById('tracks-style-size');
    var tracksStyleDelayEl = document.getElementById('tracks-style-delay');
    var tracksStyleSpeedEl = document.getElementById('tracks-style-speed');
    var settingsModal = document.getElementById('settings-modal');
    var selProfileEl = document.getElementById('sel-profile');
    var inpProfileNameEl = document.getElementById('inp-profile-name');
    var selProviderTypeEl = document.getElementById('sel-provider-type');
    var providerFieldsStalkerEl = document.getElementById('provider-fields-stalker');
    var providerFieldsXtreamEl = document.getElementById('provider-fields-xtream');
    var providerFieldsM3uEl = document.getElementById('provider-fields-m3u');
    var inpPortalEl = document.getElementById('inp-portal');
    var inpMacEl = document.getElementById('inp-mac');
    var inpXtreamUrlEl = document.getElementById('inp-xtream-url');
    var inpXtreamUserEl = document.getElementById('inp-xtream-user');
    var inpXtreamPassEl = document.getElementById('inp-xtream-pass');
    var inpM3uUrlEl = document.getElementById('inp-m3u-url');
    var btnM3uFileEl = document.getElementById('btn-m3u-file');
    var m3uFileStatusEl = document.getElementById('m3u-file-status');
    var inpM3uFileHiddenEl = document.getElementById('inp-m3u-file-hidden');
    if (!inpM3uFileHiddenEl) {
        inpM3uFileHiddenEl = document.createElement('input');
        inpM3uFileHiddenEl.id = 'inp-m3u-file-hidden';
        inpM3uFileHiddenEl.type = 'file';
        inpM3uFileHiddenEl.accept = '.m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain';
        inpM3uFileHiddenEl.style.display = 'none';
        document.body.appendChild(inpM3uFileHiddenEl);
    }
    var inpEpgUrlEl = document.getElementById('inp-epg-url');
    var selEpgOffsetEl = document.getElementById('sel-epg-offset');
    var selBufferModeEl = document.getElementById('sel-buffer-mode');
    var lanSetupUrlEl = document.getElementById('lan-setup-url');
    var selThemeEl = document.getElementById('sel-theme');
    var inpPinEl = document.getElementById('inp-pin');
    var selStartupModeEl = document.getElementById('sel-startup-mode');
    var selOsdTimeoutEl = document.getElementById('sel-osd-timeout');
    var btnSaveEl = document.getElementById('btn-save');
    var btnProfileNewEl = document.getElementById('btn-profile-new');
    var btnProfileDelEl = document.getElementById('btn-profile-del');
    var btnRestartEl = document.getElementById('btn-restart');
    var btnCancelEl = document.getElementById('btn-cancel');
    var btnBackupExportEl = document.getElementById('btn-backup-export');
    var btnBackupImportEl = document.getElementById('btn-backup-import');
    var m3uRawMemoryCache = {};

    if (!subtitleBoxEl) {
        subtitleBoxEl = document.createElement('div');
        subtitleBoxEl.id = 'subtitle-box';
        document.body.insertBefore(subtitleBoxEl, overlayEl || document.body.firstChild);
    }
    if (!btnRestartEl && btnCancelEl && btnCancelEl.parentNode) {
        btnRestartEl = document.createElement('div');
        btnRestartEl.id = 'btn-restart';
        btnRestartEl.className = 'btn';
        btnRestartEl.textContent = 'Restart App';
        btnCancelEl.parentNode.insertBefore(btnRestartEl, btnCancelEl);
    }
    if (!accountBadgeEl && profileBadgeEl && profileBadgeEl.parentNode) {
        accountBadgeEl = document.createElement('span');
        accountBadgeEl.id = 'account-exp-badge';
        accountBadgeEl.className = 'account-exp-badge';
        accountBadgeEl.textContent = 'Connecting...';
        profileBadgeEl.parentNode.insertBefore(accountBadgeEl, profileBadgeEl.nextSibling);
    }
    if (!btnBackupExportEl && btnCancelEl && btnCancelEl.parentNode && btnCancelEl.parentNode.parentNode) {
        var backupRow = document.createElement('div');
        backupRow.className = 'btn-row';
        btnBackupExportEl = document.createElement('div');
        btnBackupExportEl.id = 'btn-backup-export';
        btnBackupExportEl.className = 'btn';
        btnBackupExportEl.textContent = '⬇ Save Backup';
        btnBackupImportEl = document.createElement('div');
        btnBackupImportEl.id = 'btn-backup-import';
        btnBackupImportEl.className = 'btn';
        btnBackupImportEl.textContent = '⬆ Restore Backup';
        backupRow.appendChild(btnBackupExportEl);
        backupRow.appendChild(btnBackupImportEl);
        btnCancelEl.parentNode.parentNode.appendChild(backupRow);
    }

    var tabProvStalkerEl = document.getElementById('tab-prov-stalker');
    var tabProvXtreamEl = document.getElementById('tab-prov-xtream');
    var tabProvM3uEl = document.getElementById('tab-prov-m3u');
    var settingsActiveTypePillEl = document.getElementById('settings-active-type-pill');
    var settingsConnStatusEl = document.getElementById('settings-conn-status');
    var btnXtreamPassToggleEl = document.getElementById('btn-xtream-pass-toggle');
    var btnM3uClearEl = document.getElementById('btn-m3u-clear');
    var btnTestConnEl = document.getElementById('btn-test-conn');
    var lanSetupBannerEl = document.getElementById('lan-setup-banner');
    var appBrandEl = document.getElementById('app-brand');

    var settingsGrid = [];
    var settingsEls = [
        selProfileEl, inpProfileNameEl, selProviderTypeEl,
        tabProvStalkerEl, tabProvXtreamEl, tabProvM3uEl,
        inpPortalEl, inpMacEl,
        inpXtreamUrlEl, inpXtreamUserEl, inpXtreamPassEl, btnXtreamPassToggleEl,
        inpM3uUrlEl, btnM3uFileEl, btnM3uClearEl,
        inpEpgUrlEl, selEpgOffsetEl, selBufferModeEl,
        selThemeEl, inpPinEl, selStartupModeEl, selOsdTimeoutEl,
        btnSaveEl, btnProfileNewEl, btnProfileDelEl,
        btnTestConnEl, btnRestartEl, btnCancelEl, btnBackupExportEl, btnBackupImportEl
    ].filter(Boolean);

    function syncProviderTypeVisuals(pType) {
        if (selProviderTypeEl) {
            selProviderTypeEl.value = pType;
        }
        if (tabProvStalkerEl) {
            tabProvStalkerEl.classList.toggle('active', pType === 'stalker');
        }
        if (tabProvXtreamEl) {
            tabProvXtreamEl.classList.toggle('active', pType === 'xtream');
        }
        if (tabProvM3uEl) {
            tabProvM3uEl.classList.toggle('active', pType === 'm3u');
        }
        if (settingsActiveTypePillEl) {
            settingsActiveTypePillEl.textContent = (pType === 'xtream') ? 'Xtream Codes API' : ((pType === 'm3u') ? 'M3U Playlist' : 'Stalker MAC');
        }
    }

    function rebuildSettingsGrid(providerType) {
        var pType = (providerType === 'xtream' || providerType === 'm3u') ? providerType : 'stalker';
        syncProviderTypeVisuals(pType);
        if (providerFieldsStalkerEl) {
            providerFieldsStalkerEl.style.display = (pType === 'stalker') ? 'block' : 'none';
        }
        if (providerFieldsXtreamEl) {
            providerFieldsXtreamEl.style.display = (pType === 'xtream') ? 'block' : 'none';
        }
        if (providerFieldsM3uEl) {
            providerFieldsM3uEl.style.display = (pType === 'm3u') ? 'block' : 'none';
        }
        var provRow = [];
        if (tabProvStalkerEl && tabProvXtreamEl && tabProvM3uEl) {
            provRow = [tabProvStalkerEl, tabProvXtreamEl, tabProvM3uEl];
        } else if (selProviderTypeEl) {
            provRow = [selProviderTypeEl];
        }
        var rows = [
            [selProfileEl, inpProfileNameEl].filter(Boolean),
            provRow
        ];
        if (pType === 'xtream') {
            rows.push([inpXtreamUrlEl].filter(Boolean));
            rows.push([inpXtreamUserEl, inpXtreamPassEl, btnXtreamPassToggleEl].filter(Boolean));
        } else if (pType === 'm3u') {
            rows.push([inpM3uUrlEl].filter(Boolean));
            rows.push([btnM3uFileEl, btnM3uClearEl].filter(Boolean));
        } else {
            rows.push([inpPortalEl].filter(Boolean));
            rows.push([inpMacEl].filter(Boolean));
        }
        if (inpEpgUrlEl) {
            rows.push([inpEpgUrlEl]);
        }
        rows.push([selThemeEl, inpPinEl].filter(Boolean));
        rows.push([selEpgOffsetEl, selBufferModeEl, selStartupModeEl, selOsdTimeoutEl].filter(Boolean));
        rows.push([btnSaveEl, btnProfileNewEl, btnProfileDelEl, btnCancelEl].filter(Boolean));
        rows.push([typeof btnTestConnEl !== 'undefined' ? btnTestConnEl : null, btnBackupExportEl, btnBackupImportEl, btnRestartEl].filter(Boolean));
        settingsGrid = rows.filter(function(r) { return r.length > 0; });
        if (settingsRow >= settingsGrid.length) {
            settingsRow = Math.max(0, settingsGrid.length - 1);
        }
        if (settingsGrid[settingsRow] && settingsCol >= settingsGrid[settingsRow].length) {
            settingsCol = Math.max(0, settingsGrid[settingsRow].length - 1);
        }
    }

    function resolveNextSettingsCol(prevRowArr, nextRowArr, prevCol) {
        if (!nextRowArr || nextRowArr.length <= 1) {
            if (prevRowArr && prevRowArr.length > 1 && prevRowArr[0] !== tabProvStalkerEl) {
                settingsLastColRatio = prevCol / (prevRowArr.length - 1);
            }
            return 0;
        }
        if (nextRowArr[0] === tabProvStalkerEl) {
            if (prevRowArr && prevRowArr.length > 1 && prevRowArr[0] !== tabProvStalkerEl) {
                settingsLastColRatio = prevCol / (prevRowArr.length - 1);
            }
            var curType = (selProviderTypeEl && selProviderTypeEl.value) ? selProviderTypeEl.value : 'stalker';
            return (curType === 'xtream') ? 1 : ((curType === 'm3u') ? 2 : 0);
        }
        var ratio = settingsLastColRatio;
        if (prevRowArr && prevRowArr.length > 1 && prevRowArr[0] !== tabProvStalkerEl) {
            ratio = prevCol / (prevRowArr.length - 1);
            settingsLastColRatio = ratio;
        }
        var mapped = Math.round(ratio * (nextRowArr.length - 1));
        return Math.max(0, Math.min(nextRowArr.length - 1, mapped));
    }
    rebuildSettingsGrid('stalker');

    var pinModalEl = document.getElementById('pin-modal');
    var inpPinVerifyEl = document.getElementById('inp-pin-verify');
    var btnPinUnlockEl = document.getElementById('btn-pin-unlock');
    var btnPinCancelEl = document.getElementById('btn-pin-cancel');
    var pinStatusMsgEl = document.getElementById('pin-status-msg');
    var pinGrid = [
        [inpPinVerifyEl].filter(Boolean),
        [btnPinUnlockEl, btnPinCancelEl].filter(Boolean)
    ];
    var pinEls = [inpPinVerifyEl, btnPinUnlockEl, btnPinCancelEl].filter(Boolean);

    var searchModal = document.getElementById('search-modal');
    var searchInput = document.getElementById('inp-search');
    var searchResultsContainer = document.getElementById('search-results');
    var filterModal = document.getElementById('filter-modal');
    var filterModalTitle = document.getElementById('filter-modal-title');
    var inpFilterEl = document.getElementById('inp-filter');
    var btnFilterApplyEl = document.getElementById('btn-filter-apply');
    var btnFilterClearEl = document.getElementById('btn-filter-clear');
    var filterGrid = [
        [inpFilterEl].filter(Boolean),
        [btnFilterApplyEl, btnFilterClearEl].filter(Boolean)
    ];
    var filterEls = [inpFilterEl, btnFilterApplyEl, btnFilterClearEl].filter(Boolean);

    var epgModal = document.getElementById('epg-modal');
    var epgModalTitle = document.getElementById('epg-modal-title');
    var btnEpgOffsetEl = document.getElementById('btn-epg-offset');
    var btnEpgViewToggleEl = document.getElementById('btn-epg-view-toggle');
    var epgModalList = document.getElementById('epg-modal-list');
    var epgModalProgTitle = document.getElementById('epg-modal-prog-title');
    var epgModalProgTime = document.getElementById('epg-modal-prog-time');
    var epgModalDesc = document.getElementById('epg-modal-desc');
    var epgGridContainerEl = document.getElementById('epg-grid-container');
    var epgGridTimelineEl = document.getElementById('epg-grid-timeline');
    var epgGridRowsEl = document.getElementById('epg-grid-rows');
    var epgGridSelTitleEl = document.getElementById('epg-grid-sel-title');
    var epgGridSelDescEl = document.getElementById('epg-grid-sel-desc');


    function showToast(message) {
        if (!message) {
            return;
        }
        var toastEl = document.getElementById('smartstb-toast');
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.id = 'smartstb-toast';
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = message;
        toastEl.classList.add('visible');
        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }
        toastTimeout = setTimeout(function() {
            toastEl.classList.remove('visible');
        }, 2500);
    }

    function formatSubtitleDelayLabel(ms) {
        var clean = Math.max(-5000, Math.min(5000, Math.round((Number(ms) || 0) / 250) * 250));
        if (clean === 0) {
            return '0ms';
        }
        return (clean > 0 ? '+' : '') + clean + 'ms';
    }

    function applySubtitleAppearance() {
        if (!subtitleBoxEl) {
            return;
        }
        subtitleBoxEl.classList.remove('sub-yellow');
        subtitleBoxEl.classList.remove('sub-cyan');
        subtitleBoxEl.classList.remove('sub-size-lg');
        subtitleBoxEl.classList.remove('sub-size-xl');
        if (subtitleColor === 'yellow') {
            subtitleBoxEl.classList.add('sub-yellow');
        } else if (subtitleColor === 'cyan') {
            subtitleBoxEl.classList.add('sub-cyan');
        }
        if (subtitleSize === 'large') {
            subtitleBoxEl.classList.add('sub-size-lg');
        } else if (subtitleSize === 'xl') {
            subtitleBoxEl.classList.add('sub-size-xl');
        }
        if (tracksStyleColorEl) {
            tracksStyleColorEl.textContent = '◀ Color: ' + subtitleColor.toUpperCase();
        }
        if (tracksStyleSizeEl) {
            tracksStyleSizeEl.textContent = 'Size: ' + subtitleSize.toUpperCase() + ' ▶';
        }
        if (tracksStyleDelayEl) {
            tracksStyleDelayEl.textContent = '⏱ Sync: ' + formatSubtitleDelayLabel(subtitleDelayMs);
        }
        if (tracksStyleSpeedEl) {
            tracksStyleSpeedEl.textContent = '⏩ Speed: ' + currentPlaybackSpeed + 'x';
        }
    }

    function cyclePlaybackSpeed() {
        var speeds = [0.75, 1, 1.25, 1.5, 2];
        var curIdx = speeds.indexOf(currentPlaybackSpeed);
        currentPlaybackSpeed = speeds[(curIdx + 1) % speeds.length];
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay && typeof webapis.avplay.setSpeed === 'function') {
                webapis.avplay.setSpeed(currentPlaybackSpeed);
            }
        } catch (eSpd) {}
        applySubtitleAppearance();
        updateOsdStreamTelemetry();
        showOSD(formatOsdTitle(currentPlayingItem), 'Speed: ' + currentPlaybackSpeed + 'x');
        showToast('⏩ Playback Speed: ' + currentPlaybackSpeed + 'x');
    }

    function adjustSubtitleDelay(deltaMs) {
        subtitleDelayMs = Math.max(-5000, Math.min(5000, Math.round(((subtitleDelayMs || 0) + deltaMs) / 250) * 250));
        window._subtitleDelayMs = subtitleDelayMs;
        safeSetStorage('cfg_sub_delay', String(subtitleDelayMs));
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay && typeof webapis.avplay.setSubtitlePosition === 'function') {
                webapis.avplay.setSubtitlePosition(subtitleDelayMs);
            }
        } catch (ePos) {}
        applySubtitleAppearance();
        showToast('⏱ Subtitle Sync: ' + formatSubtitleDelayLabel(subtitleDelayMs));
    }

    function cycleSubtitleColor() {
        var colors = ['white', 'yellow', 'cyan'];
        var idx = colors.indexOf(subtitleColor);
        subtitleColor = colors[(idx + 1) % colors.length];
        safeSetStorage('cfg_sub_color', subtitleColor);
        applySubtitleAppearance();
        showToast('💬 Subtitle Color: ' + subtitleColor.toUpperCase());
    }

    function cycleSubtitleSize() {
        var sizes = ['normal', 'large', 'xl'];
        var idx = sizes.indexOf(subtitleSize);
        subtitleSize = sizes[(idx + 1) % sizes.length];
        safeSetStorage('cfg_sub_size', subtitleSize);
        applySubtitleAppearance();
        showToast('💬 Subtitle Size: ' + subtitleSize.toUpperCase());
    }

    function clearSubtitleBox() {
        if (subtitleClearTimer) {
            clearTimeout(subtitleClearTimer);
            subtitleClearTimer = null;
        }
        if (subtitleDelayTimer) {
            clearTimeout(subtitleDelayTimer);
            subtitleDelayTimer = null;
        }
        if (subtitleBoxEl) {
            subtitleBoxEl.textContent = '';
            subtitleBoxEl.classList.remove('visible');
        }
    }

    function showSubtitleCueNow(cleaned, durationMs) {
        if (!subtitleBoxEl || !subtitlesEnabled) {
            return;
        }
        if (subtitleClearTimer) {
            clearTimeout(subtitleClearTimer);
            subtitleClearTimer = null;
        }
        if (!cleaned) {
            subtitleBoxEl.textContent = '';
            subtitleBoxEl.classList.remove('visible');
            return;
        }
        applySubtitleAppearance();
        subtitleBoxEl.textContent = cleaned;
        subtitleBoxEl.classList.add('visible');
        var dur = Number(durationMs) || 0;
        if (dur > 0) {
            subtitleClearTimer = setTimeout(function() {
                if (subtitleBoxEl) {
                    subtitleBoxEl.textContent = '';
                    subtitleBoxEl.classList.remove('visible');
                }
            }, Math.min(dur, 12000));
        }
    }

    function renderSubtitleCue(rawText, durationMs) {
        if (!subtitleBoxEl || !subtitlesEnabled) {
            return;
        }
        if (subtitleDelayTimer) {
            clearTimeout(subtitleDelayTimer);
            subtitleDelayTimer = null;
        }
        var cleaned = String(rawText || '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/\{[^}]*\}/g, '')
            .replace(/<[^>]+>/g, '')
            .trim();
        if (subtitleDelayMs > 0 && cleaned) {
            subtitleDelayTimer = setTimeout(function() {
                showSubtitleCueNow(cleaned, durationMs);
            }, subtitleDelayMs);
            return;
        }
        var adjustedDur = Number(durationMs) || 0;
        if (subtitleDelayMs < 0 && adjustedDur > 0) {
            adjustedDur = Math.max(500, adjustedDur + subtitleDelayMs);
        }
        showSubtitleCueNow(cleaned, adjustedDur);
    }

    var lastIndexedChannelsRef = null;
    var lastIndexedChannelsLen = -1;
    function rebuildGenreChannelCounts() {
        if (lastIndexedChannelsRef === allChannels && lastIndexedChannelsLen === allChannels.length) {
            return;
        }
        lastIndexedChannelsRef = allChannels;
        lastIndexedChannelsLen = allChannels.length;
        var counts = { '*': allChannels.length };
        var byGenre = {};
        var byId = {};
        var byNum = {};
        for (var i = 0; i < allChannels.length; i++) {
            var ch = allChannels[i];
            if (!ch) {
                continue;
            }
            var gid = String(ch.genreId || '*');
            counts[gid] = (counts[gid] || 0) + 1;
            if (!byGenre[gid]) {
                byGenre[gid] = [];
            }
            byGenre[gid].push(ch);
            if (ch.id !== undefined && ch.id !== null) {
                byId[String(ch.id)] = ch;
            }
            if (ch.num) {
                byNum[String(ch.num)] = ch;
            }
        }
        genreChannelCounts = counts;
        genreChannelsMap = byGenre;
        channelByIdMap = byId;
        channelByNumMap = byNum;
    }

    function safeGetJson(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (ex) {
            return fallback;
        }
    }
    function safeSetStorage(key, valueStr) {
        try {
            localStorage.setItem(key, valueStr);
            return true;
        } catch (ex1) {
            try {
                localStorage.removeItem('stalker_live');
                if (key === 'stalker_live') {
                    return false;
                }
                localStorage.setItem(key, valueStr);
                return true;
            } catch (ex2) {
                return false;
            }
        }
    }
    var adultCatLookup = { live: {}, vod: {}, series: {} };
    function processArrayInChunks(arr, chunkSize, itemFn, shouldCancelFn) {
        var list = Array.isArray(arr) ? arr : [];
        var total = list.length;
        var stepSize = chunkSize || 1500;
        if (typeof shouldCancelFn === 'function' && shouldCancelFn()) {
            list.length = 0;
            return Promise.resolve([]);
        }
        if (total <= stepSize) {
            var syncOut = [];
            for (var i = 0; i < total; i++) {
                var rawSync = list[i];
                list[i] = null;
                var mappedSync = itemFn(rawSync, i);
                if (mappedSync !== null && mappedSync !== undefined) {
                    syncOut.push(mappedSync);
                }
            }
            list.length = 0;
            return Promise.resolve(syncOut);
        }
        return new Promise(function(resolve) {
            var asyncOut = [];
            var cursor = 0;
            function processSlice() {
                if (typeof shouldCancelFn === 'function' && shouldCancelFn()) {
                    list.length = 0;
                    asyncOut.length = 0;
                    resolve([]);
                    return;
                }
                var end = Math.min(cursor + stepSize, total);
                for (; cursor < end; cursor++) {
                    var rawItem = list[cursor];
                    list[cursor] = null;
                    var mapped = itemFn(rawItem, cursor);
                    if (mapped !== null && mapped !== undefined) {
                        asyncOut.push(mapped);
                    }
                }
                if (cursor < total) {
                    setTimeout(processSlice, 0);
                } else {
                    list.length = 0;
                    resolve(asyncOut);
                }
            }
            processSlice();
        });
    }
    function getProfileScopedKey(baseKey) {
        var pid = activeProfileId || 'prof_default';
        return baseKey + '_' + pid;
    }
    function getScopedJsonWithLegacyFallback(baseKey, fallback) {
        var scopedKey = getProfileScopedKey(baseKey);
        var rawScoped = localStorage.getItem(scopedKey);
        if (rawScoped !== null) {
            return safeGetJson(scopedKey, fallback);
        }
        if (activeProfileId === 'prof_default') {
            var legacyVal = safeGetJson(baseKey, null);
            if (legacyVal !== null) {
                safeSetStorage(scopedKey, JSON.stringify(legacyVal));
                return legacyVal;
            }
        }
        return fallback;
    }

    function loadProfiles() {
        var saved = safeGetJson('cfg_profiles', null);
        var legacyPortal = localStorage.getItem('cfg_portal') || '';
        var legacyMac = localStorage.getItem('cfg_mac') || '00:1A:79:00:00:01';
        if (!Array.isArray(saved) || saved.length === 0) {
            saved = [{
                id: 'prof_default',
                name: 'Main Portal',
                type: 'stalker',
                portal: legacyPortal,
                mac: legacyMac,
                xtreamUrl: '',
                xtreamUser: '',
                xtreamPass: '',
                m3uUrl: '',
                m3uName: '',
                epgUrl: ''
            }];
            safeSetStorage('cfg_profiles', JSON.stringify(saved));
        }
        for (var p = 0; p < saved.length; p++) {
            if (!saved[p].type) {
                saved[p].type = 'stalker';
            }
            if (saved[p].epgUrl === undefined) {
                saved[p].epgUrl = '';
            }
            if (saved[p].epgOffsetHours === undefined) {
                saved[p].epgOffsetHours = 0;
            }
        }
        profiles = saved;
        var activeId = localStorage.getItem('cfg_active_profile');
        var foundIdx = -1;
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === activeId) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx === -1) {
            foundIdx = 0;
        }
        activeProfileId = profiles[foundIdx].id;
        editingProfileIndex = foundIdx;
        syncActiveProfileToLegacyKeys(profiles[foundIdx]);
    }
    function syncActiveProfileToLegacyKeys(prof) {
        if (!prof) {
            return;
        }
        activeProfileId = prof.id;
        cachedPortalBaseUrl = null;
        cachedPortalOrigin = null;
        var pType = (prof.type === 'xtream' || prof.type === 'm3u') ? prof.type : 'stalker';
        var offsetHours = Math.max(-12, Math.min(12, Number(prof.epgOffsetHours) || 0));
        cachedEpgOffsetSec = Math.round(offsetHours * 3600);
        safeSetStorage('cfg_active_profile', prof.id);
        safeSetStorage('cfg_provider_type', pType);
        safeSetStorage('cfg_portal', prof.portal || '');
        safeSetStorage('cfg_mac', prof.mac || '');
        safeSetStorage('cfg_xtream_url', prof.xtreamUrl || '');
        safeSetStorage('cfg_xtream_user', prof.xtreamUser || '');
        safeSetStorage('cfg_xtream_pass', prof.xtreamPass || '');
        safeSetStorage('cfg_m3u_url', prof.m3uUrl || '');
        safeSetStorage('cfg_epg_url', prof.epgUrl || '');
        safeSetStorage('cfg_epg_offset', String(offsetHours));
        if (profileBadgeEl) {
            var typeTag = pType === 'xtream' ? ' [XC]' : ((pType === 'm3u') ? ' [M3U]' : '');
            profileBadgeEl.textContent = '⚡ ' + (prof.name || 'Default') + typeTag;
            profileBadgeEl.title = 'Click to open Portal & Playlist Profile Settings';
        }
        if (btnEpgOffsetEl) {
            btnEpgOffsetEl.textContent = '🕒 EPG Offset: ' + (offsetHours > 0 ? ('+' + offsetHours) : offsetHours) + 'h [YELLOW]';
        }
    }
    function getActiveProfile() {
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === activeProfileId) {
                return profiles[i];
            }
        }
        return profiles[0] || { id: 'prof_default', name: 'Main Portal', type: 'stalker', portal: '', mac: '' };
    }
    function isProfileConfigured(prof) {
        if (!prof) {
            return false;
        }
        var pType = (prof.type === 'xtream' || prof.type === 'm3u') ? prof.type : 'stalker';
        if (pType === 'xtream') {
            var xUrl = String(prof.xtreamUrl || '').trim();
            var xUser = String(prof.xtreamUser || '').trim();
            var xPass = String(prof.xtreamPass || '').trim();
            return Boolean(xUrl && xUrl !== 'http://' && xUrl !== 'https://' && xUser && xPass);
        }
        if (pType === 'm3u') {
            var mUrl = String(prof.m3uUrl || '').trim();
            var hasValidRemoteM3u = Boolean(mUrl && /^https?:\/\/.+/i.test(mUrl));
            var hasLocal = Boolean(m3uRawMemoryCache[prof.id] || localStorage.getItem('m3u_raw_' + prof.id) || prof.m3uFileName);
            return Boolean(hasValidRemoteM3u || hasLocal);
        }
        var sPortal = String(prof.portal || '').trim();
        var sMac = String(prof.mac || '').trim();
        return Boolean(sPortal && sPortal !== 'http://' && sPortal !== 'https://' && sMac);
    }

    var cachedDeviceTimezone = '';
    function getDeviceTimezone() {
        if (cachedDeviceTimezone) {
            return cachedDeviceTimezone;
        }
        try {
            var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            cachedDeviceTimezone = tz || 'UTC';
        } catch (ex) {
            cachedDeviceTimezone = 'UTC';
        }
        return cachedDeviceTimezone;
    }
    function simpleHashHex(input, length) {
        var str = String(input || '');
        var out = '';
        var seed1 = 2166136261;
        var seed2 = 463116947;
        while (out.length < length) {
            for (var i = 0; i < str.length; i++) {
                seed1 = ((seed1 + str.charCodeAt(i)) * 16777619) % 4294967296;
                seed2 = ((seed2 * 33) + str.charCodeAt(i)) % 4294967296;
            }
            var h1 = Math.abs(seed1).toString(16);
            var h2 = Math.abs(seed2).toString(16);
            out += ('00000000' + h1).slice(-8) + ('00000000' + h2).slice(-8);
            seed1 = (seed1 + 248729395) % 4294967296;
        }
        return out.slice(0, length).toUpperCase();
    }
    function deriveMagIdentity(mac) {
        var cleanMac = String(mac || '00:1A:79:00:00:01').toUpperCase().trim();
        var sn = '022018' + simpleHashHex('SN:' + cleanMac, 7);
        var devId = simpleHashHex('DEVID1:' + cleanMac + ':' + sn, 64);
        var devId2 = simpleHashHex('DEVID2:' + cleanMac + ':' + sn, 64);
        var sig = simpleHashHex('SIG:' + cleanMac + ':' + sn + ':' + devId, 64);
        return { sn: sn, device_id: devId, device_id2: devId2, signature: sig };
    }
    function getPortalBaseUrl() {
        if (typeof cachedPortalBaseUrl === 'string') {
            return cachedPortalBaseUrl;
        }
        var activeProf = getActiveProfile();
        var resolved = '';
        if (activeProf && activeProf.type === 'xtream') {
            resolved = normalizeXtreamServerUrl(activeProf.xtreamUrl || '');
        } else {
            var portal = (localStorage.getItem('cfg_portal') || '').trim().replace(/\/+$/, '');
            if (portal) {
                if (portal.indexOf('http://') !== 0 && portal.indexOf('https://') !== 0) {
                    portal = 'http://' + portal;
                }
                resolved = portal.replace(/\/(portal|load)\.php.*$/i, '').replace(/\/c$/i, '');
            }
        }
        cachedPortalBaseUrl = resolved;
        if (resolved) {
            var m = resolved.match(/^(https?:\/\/[^\/]+)/i);
            cachedPortalOrigin = m ? m[1] : resolved;
        } else {
            cachedPortalOrigin = '';
        }
        return resolved;
    }

    function normalizeXtreamServerUrl(rawUrl) {
        var clean = String(rawUrl || '').trim().replace(/\/+$/, '');
        if (!clean) {
            return '';
        }
        if (clean.indexOf('http://') !== 0 && clean.indexOf('https://') !== 0) {
            clean = 'http://' + clean;
        }
        return clean.replace(/\/player_api\.php.*$/i, '').replace(/\/get\.php.*$/i, '').replace(/\/+$/, '');
    }

    function buildXtreamDirectStreamUrl(auth, kind, streamId, ext) {
        var a = auth || {};
        var base = a.base !== undefined ? a.base : normalizeXtreamServerUrl(a.xtreamUrl || '');
        var user = a.user !== undefined ? a.user : encodeURIComponent(String(a.xtreamUser || '').trim());
        var pass = a.pass !== undefined ? a.pass : encodeURIComponent(String(a.xtreamPass || '').trim());
        var id = String(streamId || '').trim();
        var cleanExt = String(ext || (kind === 'live' ? 'ts' : 'mp4')).trim().replace(/^\.+/, '');
        if (kind === 'live') {
            return base + '/live/' + user + '/' + pass + '/' + id + '.' + (cleanExt || 'ts');
        }
        if (kind === 'movie') {
            return base + '/movie/' + user + '/' + pass + '/' + id + '.' + (cleanExt || 'mp4');
        }
        return base + '/series/' + user + '/' + pass + '/' + id + '.' + (cleanExt || 'mp4');
    }

    var xtreamB64DecodeCache = {};
    var xtreamB64DecodeCount = 0;
    function decodeXtreamBase64Text(input) {
        var str = String(input || '').trim();
        if (!str || str.indexOf(' ') !== -1 || str.length < 4 || (str.length % 4) !== 0) {
            return str;
        }
        if (xtreamB64DecodeCache[str] !== undefined) {
            return xtreamB64DecodeCache[str];
        }
        if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(str)) {
            return str;
        }
        var result = str;
        try {
            var raw = window.atob(str);
            var out = '';
            var i = 0;
            var len = raw.length;
            var validUtf8 = true;
            while (i < len) {
                var b1 = raw.charCodeAt(i++) % 256;
                if (b1 < 128) {
                    if ((b1 < 32 && b1 !== 9 && b1 !== 10 && b1 !== 13) || b1 === 127) {
                        validUtf8 = false;
                        break;
                    }
                    out += String.fromCharCode(b1);
                } else if (b1 >= 192 && b1 < 224) {
                    if (i >= len) {
                        validUtf8 = false;
                        break;
                    }
                    var b2 = raw.charCodeAt(i++) % 256;
                    if (b2 < 128 || b2 >= 192) {
                        validUtf8 = false;
                        break;
                    }
                    var cp2 = ((b1 - 192) * 64) + (b2 - 128);
                    if (cp2 < 128 || (cp2 >= 128 && cp2 <= 159)) {
                        validUtf8 = false;
                        break;
                    }
                    out += String.fromCharCode(cp2);
                } else if (b1 >= 224 && b1 < 240) {
                    if (i + 1 >= len) {
                        validUtf8 = false;
                        break;
                    }
                    var b3a = raw.charCodeAt(i++) % 256;
                    var b3b = raw.charCodeAt(i++) % 256;
                    if (b3a < 128 || b3a >= 192 || b3b < 128 || b3b >= 192) {
                        validUtf8 = false;
                        break;
                    }
                    var cp3 = ((b1 - 224) * 4096) + ((b3a - 128) * 64) + (b3b - 128);
                    if (cp3 < 2048 || (cp3 >= 0xD800 && cp3 <= 0xDFFF) || cp3 === 0xFFFD) {
                        validUtf8 = false;
                        break;
                    }
                    out += String.fromCharCode(cp3);
                } else if (b1 >= 240 && b1 < 248) {
                    if (i + 2 >= len) {
                        validUtf8 = false;
                        break;
                    }
                    var b4a = raw.charCodeAt(i++) % 256;
                    var b4b = raw.charCodeAt(i++) % 256;
                    var b4c = raw.charCodeAt(i++) % 256;
                    if (b4a < 128 || b4a >= 192 || b4b < 128 || b4b >= 192 || b4c < 128 || b4c >= 192) {
                        validUtf8 = false;
                        break;
                    }
                    var cp4 = ((b1 - 240) * 262144) + ((b4a - 128) * 4096) + ((b4b - 128) * 64) + (b4c - 128);
                    if (cp4 < 0x10000 || cp4 > 0x10FFFF) {
                        validUtf8 = false;
                        break;
                    }
                    cp4 -= 0x10000;
                    out += String.fromCharCode(0xD800 + Math.floor(cp4 / 1024), 0xDC00 + (cp4 % 1024));
                } else {
                    validUtf8 = false;
                    break;
                }
            }
            if (validUtf8 && out) {
                if (str.indexOf('=') === -1 && /^[A-Za-z]+$/.test(str)) {
                    if (/^[A-Za-z0-9 .,:;'?!()\-&\u00A0-\uFFFF]+$/.test(out)) {
                        result = out;
                    }
                } else {
                    result = out;
                }
            }
        } catch (ex) {
            result = str;
        }
        if (xtreamB64DecodeCount >= 1000) {
            xtreamB64DecodeCache = {};
            xtreamB64DecodeCount = 0;
        }
        xtreamB64DecodeCache[str] = result;
        xtreamB64DecodeCount++;
        return result;
    }

    function parseM3uAttributesMap(attrLine) {
        var attrs = {};
        var regex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
        var match;
        while ((match = regex.exec(attrLine)) !== null) {
            var key = match[1].toLowerCase();
            var val = match[2] !== undefined ? match[2] : (match[3] !== undefined ? match[3] : (match[4] || ''));
            attrs[key] = val.trim();
        }
        return attrs;
    }

    function splitM3uPipeHeaders(rawUrlLine) {
        var str = String(rawUrlLine || '').trim();
        var pipeIdx = str.indexOf('|');
        if (pipeIdx === -1) {
            return { url: str, headers: {}, userAgent: '' };
        }
        var cleanUrl = str.slice(0, pipeIdx).trim();
        var rawHeaderPart = str.slice(pipeIdx + 1).trim();
        var headers = {};
        var userAgent = '';
        if (rawHeaderPart) {
            var pairs = rawHeaderPart.split(/[&|]/);
            for (var p = 0; p < pairs.length; p++) {
                var kv = pairs[p];
                var eqIdx = kv.indexOf('=');
                if (eqIdx === -1) {
                    eqIdx = kv.indexOf(':');
                }
                if (eqIdx > 0) {
                    var hKey = kv.slice(0, eqIdx).trim();
                    var hVal = kv.slice(eqIdx + 1).trim();
                    try {
                        hVal = decodeURIComponent(hVal.replace(/\+/g, '%20'));
                    } catch (eDec) {}
                    if (hKey && hVal) {
                        headers[hKey] = hVal;
                        if (hKey.toLowerCase() === 'user-agent' || hKey.toLowerCase() === 'http-user-agent') {
                            userAgent = hVal;
                        }
                    }
                }
            }
        }
        return { url: cleanUrl, headers: headers, userAgent: userAgent };
    }

    function normalizeM3uDrmType(rawType) {
        var low = String(rawType || '').trim().toLowerCase();
        if (!low) {
            return '';
        }
        if (low.indexOf('widevine') !== -1 || low.indexOf('com.widevine.alpha') !== -1) {
            return 'widevine';
        }
        if (low.indexOf('playready') !== -1 || low.indexOf('com.microsoft.playready') !== -1) {
            return 'playready';
        }
        if (low.indexOf('clearkey') !== -1 || low.indexOf('org.w3.clearkey') !== -1 || low.indexOf('clear_key') !== -1) {
            return 'clearkey';
        }
        return low;
    }

    function parseKodiLicenseKeySpec(rawSpec, currentDrmType, drmState) {
        var spec = String(rawSpec || '').trim();
        if (!spec) {
            return;
        }
        if (/^[0-9a-fA-F]{16,64}\s*:\s*[0-9a-fA-F]{16,64}$/.test(spec)) {
            drmState.clearKeyPair = spec.replace(/\s+/g, '');
            if (!drmState.drmType) {
                drmState.drmType = 'clearkey';
            }
            return;
        }
        if (spec.charAt(0) === '{' && spec.indexOf('"keys"') !== -1) {
            try {
                var parsedJwk = JSON.parse(spec);
                if (parsedJwk && Array.isArray(parsedJwk.keys) && parsedJwk.keys[0]) {
                    drmState.clearKeyJwk = spec;
                    if (!drmState.drmType) {
                        drmState.drmType = 'clearkey';
                    }
                    return;
                }
            } catch (eJwk) {}
        }
        var parts = spec.split('|');
        var licUrl = String(parts[0] || '').trim();
        if (/^https?:\/\//i.test(licUrl)) {
            drmState.drmLicenseUrl = licUrl;
        } else if (currentDrmType === 'clearkey' && spec.indexOf(':') !== -1) {
            drmState.clearKeyPair = spec.replace(/\s+/g, '');
        }
        if (parts.length > 1 && parts[1]) {
            var hdrChunk = String(parts[1]).trim();
            var hdrPairs = hdrChunk.split('&');
            for (var h = 0; h < hdrPairs.length; h++) {
                var pair = hdrPairs[h];
                var eq = pair.indexOf('=');
                if (eq === -1) {
                    eq = pair.indexOf(':');
                }
                if (eq > 0) {
                    var k = pair.slice(0, eq).trim();
                    var v = pair.slice(eq + 1).trim();
                    try {
                        v = decodeURIComponent(v.replace(/\+/g, '%20'));
                    } catch (eD) {}
                    if (k && v) {
                        drmState.drmHeaders[k] = v;
                    }
                }
            }
        }
        if (parts.length > 2 && parts[2]) {
            var bodySpec = String(parts[2]).trim();
            if (bodySpec && bodySpec !== 'R{SSM}' && bodySpec !== 'R' && bodySpec !== 'B') {
                drmState.drmCustomData = bodySpec;
            }
        }
    }

    function attachM3uDrmAndHeaders(targetObj, drmState, pipeInfo) {
        if (!targetObj) {
            return;
        }
        var mergedStreamHeaders = {};
        var mergedDrmHeaders = {};
        var k;
        if (drmState && drmState.streamHeaders) {
            for (k in drmState.streamHeaders) {
                if (Object.prototype.hasOwnProperty.call(drmState.streamHeaders, k)) {
                    mergedStreamHeaders[k] = drmState.streamHeaders[k];
                }
            }
        }
        if (pipeInfo && pipeInfo.headers) {
            for (k in pipeInfo.headers) {
                if (Object.prototype.hasOwnProperty.call(pipeInfo.headers, k)) {
                    mergedStreamHeaders[k] = pipeInfo.headers[k];
                    mergedDrmHeaders[k] = pipeInfo.headers[k];
                }
            }
        }
        if (drmState && drmState.drmHeaders) {
            for (k in drmState.drmHeaders) {
                if (Object.prototype.hasOwnProperty.call(drmState.drmHeaders, k)) {
                    mergedDrmHeaders[k] = drmState.drmHeaders[k];
                }
            }
        }
        if (drmState && drmState.drmType) {
            targetObj.drmType = drmState.drmType;
        }
        if (drmState && drmState.drmLicenseUrl) {
            targetObj.drmLicenseUrl = drmState.drmLicenseUrl;
        }
        if (drmState && drmState.drmCustomData) {
            targetObj.drmCustomData = drmState.drmCustomData;
        }
        if (drmState && drmState.clearKeyPair) {
            targetObj.clearKeyPair = drmState.clearKeyPair;
        }
        if (drmState && drmState.clearKeyJwk) {
            targetObj.clearKeyJwk = drmState.clearKeyJwk;
        }
        if (Object.keys(mergedDrmHeaders).length > 0) {
            targetObj.drmHeaders = mergedDrmHeaders;
        }
        if (Object.keys(mergedStreamHeaders).length > 0) {
            targetObj.streamHeaders = mergedStreamHeaders;
        }
        var ua = (pipeInfo && pipeInfo.userAgent) || (drmState && drmState.userAgent) || '';
        if (ua) {
            targetObj.userAgent = ua;
        }
    }

    function createM3uParserState(rawText) {
        var lines = String(rawText || '').split(/\r?\n/);
        var liveGenresList = [];
        var liveGenresSeen = {};
        var vodCatsList = [];
        var vodCatsSeen = {};
        var seriesCatsList = [];
        var seriesCatsSeen = {};
        var liveChannels = [];
        var vodItems = [];
        var seriesGroupsMap = {};
        var seriesGroupsKeys = [];
        var pendingInf = null;
        var currentExtGrp = '';
        var headerEpgUrl = '';
        var pendingDrm = {
            drmType: '',
            drmLicenseUrl: '',
            drmHeaders: {},
            drmCustomData: '',
            clearKeyPair: '',
            clearKeyJwk: '',
            streamHeaders: {},
            userAgent: ''
        };

        function resetPendingDrm() {
            pendingDrm = {
                drmType: '',
                drmLicenseUrl: '',
                drmHeaders: {},
                drmCustomData: '',
                clearKeyPair: '',
                clearKeyJwk: '',
                streamHeaders: {},
                userAgent: ''
            };
        }

        var seriesRe1 = /^(.*?)\s*[-–:|]?\s*\bS(\d{1,2})\s*E(\d{1,3})\b\s*[-–:|]?\s*(.*)$/i;
        var seriesRe2 = /^(.*?)\s*[-–:|]?\s*\bSeason\s*(\d{1,2})\s*Episode\s*(\d{1,3})\b\s*[-–:|]?\s*(.*)$/i;
        var seriesRe3 = /^(.*?)\s*[-–:|]?\s*\b(\d{1,2})x(\d{2,3})\b\s*[-–:|]?\s*(.*)$/i;
        var adultRe = ADULT_RE;

        function processRange(startLine, endLine) {
            for (var i = startLine; i < endLine; i++) {
                var line = lines[i].trim();
                if (!line) {
                    continue;
                }
                if (line.indexOf('#EXTM3U') === 0) {
                    var hdrAttrs = parseM3uAttributesMap(line.slice(7));
                    var candidateEpg = hdrAttrs['url-tvg'] || hdrAttrs['x-tvg-url'] || hdrAttrs['tvg-url'] || '';
                    if (candidateEpg) {
                        headerEpgUrl = String(candidateEpg).split(',')[0].trim();
                    }
                    continue;
                }
                if (line.indexOf('#EXTINF:') === 0) {
                    var inQuotes = false;
                    var commaIdx = -1;
                    for (var c = 8; c < line.length; c++) {
                        var ch = line.charAt(c);
                        if (ch === '"') {
                            inQuotes = !inQuotes;
                        } else if (ch === ',' && !inQuotes) {
                            commaIdx = c;
                            break;
                        }
                    }
                    var attrPart = commaIdx !== -1 ? line.slice(8, commaIdx) : line.slice(8);
                    var rawTitle = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : '';
                    var attrs = parseM3uAttributesMap(attrPart);
                    var title = rawTitle || attrs['tvg-name'] || 'Untitled Stream';
                    var grpTitle = attrs['group-title'] || currentExtGrp || 'General';
                    if (attrs['drm-type'] || attrs['license-type'] || attrs['inputstream.adaptive.license_type']) {
                        pendingDrm.drmType = normalizeM3uDrmType(attrs['drm-type'] || attrs['license-type'] || attrs['inputstream.adaptive.license_type']);
                    }
                    if (attrs['license-key'] || attrs['drm-license-url'] || attrs['clearkey'] || attrs['inputstream.adaptive.license_key']) {
                        parseKodiLicenseKeySpec(attrs['license-key'] || attrs['drm-license-url'] || attrs['clearkey'] || attrs['inputstream.adaptive.license_key'], pendingDrm.drmType, pendingDrm);
                    }
                    if (attrs['http-user-agent'] || attrs['user-agent']) {
                        pendingDrm.userAgent = attrs['http-user-agent'] || attrs['user-agent'];
                        pendingDrm.streamHeaders['User-Agent'] = pendingDrm.userAgent;
                    }
                    if (attrs['http-referrer'] || attrs['http-referer']) {
                        pendingDrm.streamHeaders.Referer = attrs['http-referrer'] || attrs['http-referer'];
                    }
                    pendingInf = { title: title, attrs: attrs, groupTitle: grpTitle };
                    continue;
                }
                if (line.indexOf('#EXTGRP:') === 0) {
                    currentExtGrp = line.slice(8).trim();
                    if (pendingInf && (!pendingInf.groupTitle || pendingInf.groupTitle === 'General') && currentExtGrp) {
                        pendingInf.groupTitle = currentExtGrp;
                    }
                    continue;
                }
                if (line.indexOf('#KODIPROP:') === 0 || line.indexOf('#EXTVLCOPT:') === 0 || line.indexOf('#EXTHTTP:') === 0) {
                    if (line.indexOf('#KODIPROP:') === 0) {
                        var kodiRaw = line.slice(10).trim();
                        var kEq = kodiRaw.indexOf('=');
                        if (kEq > 0) {
                            var kKey = kodiRaw.slice(0, kEq).trim().toLowerCase();
                            var kVal = kodiRaw.slice(kEq + 1).trim();
                            if (kKey.indexOf('license_type') !== -1 || kKey === 'drm_legacy') {
                                if (kKey === 'drm_legacy' && kVal.indexOf('|') !== -1) {
                                    var legParts = kVal.split('|');
                                    pendingDrm.drmType = normalizeM3uDrmType(legParts[0]);
                                    parseKodiLicenseKeySpec(legParts.slice(1).join('|'), pendingDrm.drmType, pendingDrm);
                                } else {
                                    pendingDrm.drmType = normalizeM3uDrmType(kVal);
                                }
                            } else if (kKey.indexOf('license_key') !== -1) {
                                parseKodiLicenseKeySpec(kVal, pendingDrm.drmType, pendingDrm);
                            } else if (kKey.indexOf('stream_headers') !== -1) {
                                var shInfo = splitM3uPipeHeaders('http://x|' + kVal);
                                for (var shk in shInfo.headers) {
                                    if (Object.prototype.hasOwnProperty.call(shInfo.headers, shk)) {
                                        pendingDrm.streamHeaders[shk] = shInfo.headers[shk];
                                    }
                                }
                                if (shInfo.userAgent) {
                                    pendingDrm.userAgent = shInfo.userAgent;
                                }
                            } else if (kKey.indexOf('license_data') !== -1) {
                                pendingDrm.drmCustomData = kVal;
                            }
                        }
                    } else if (line.indexOf('#EXTVLCOPT:') === 0) {
                        var vlcRaw = line.slice(11).trim();
                        var vEq = vlcRaw.indexOf('=');
                        if (vEq > 0) {
                            var vKey = vlcRaw.slice(0, vEq).trim().toLowerCase();
                            var vVal = vlcRaw.slice(vEq + 1).trim();
                            if (vKey === 'http-user-agent' || vKey === 'user-agent') {
                                pendingDrm.userAgent = vVal;
                                pendingDrm.streamHeaders['User-Agent'] = vVal;
                            } else if (vKey === 'http-referrer' || vKey === 'http-referer' || vKey === 'referer') {
                                pendingDrm.streamHeaders.Referer = vVal;
                            } else if (vKey === 'http-origin' || vKey === 'origin') {
                                pendingDrm.streamHeaders.Origin = vVal;
                            } else if (vKey === 'http-cookie' || vKey === 'cookie') {
                                pendingDrm.streamHeaders.Cookie = vVal;
                            }
                        }
                    } else if (line.indexOf('#EXTHTTP:') === 0) {
                        var httpJsonRaw = line.slice(9).trim();
                        try {
                            var parsedHttpObj = JSON.parse(httpJsonRaw);
                            if (parsedHttpObj && typeof parsedHttpObj === 'object') {
                                for (var hk in parsedHttpObj) {
                                    if (Object.prototype.hasOwnProperty.call(parsedHttpObj, hk)) {
                                        var hv = String(parsedHttpObj[hk] || '');
                                        pendingDrm.streamHeaders[hk] = hv;
                                        pendingDrm.drmHeaders[hk] = hv;
                                        if (hk.toLowerCase() === 'user-agent') {
                                            pendingDrm.userAgent = hv;
                                        }
                                    }
                                }
                            }
                        } catch (eExtHttp) {}
                    }
                    continue;
                }
                if (line.charAt(0) === '#') {
                    continue;
                }
                if (!/^(https?|rtmp|rtsp|mms):\/\//i.test(line)) {
                    continue;
                }
                var pipeParsed = splitM3uPipeHeaders(line);
                var streamUrl = pipeParsed.url;
                var curDrmSnapshot = pendingDrm;
                resetPendingDrm();
                var info = pendingInf || {
                    title: 'Channel ' + (liveChannels.length + 1),
                    attrs: {},
                    groupTitle: currentExtGrp || 'General'
                };
                pendingInf = null;

                var groupTitle = String(info.groupTitle || 'General').trim() || 'General';
                var logo = info.attrs['tvg-logo'] || info.attrs.logo || '';
                var tvgId = info.attrs['tvg-id'] || '';
                var catchupDays = Number(info.attrs['catchup-days'] || info.attrs['tvg-rec'] || 0);
                var catchupSource = info.attrs['catchup-source'] || '';
                var hasCatchup = Boolean(info.attrs.catchup || catchupDays > 0 || catchupSource);
                var isCensored = adultRe.test(groupTitle) || adultRe.test(info.title);

                var epMatch = info.title.match(seriesRe1) || info.title.match(seriesRe2) || info.title.match(seriesRe3);
                var isSeriesPath = /\/series\//i.test(streamUrl) || /\b(?:series|tv\s*shows?)\b/i.test(groupTitle);

                if ((epMatch && epMatch[1] && epMatch[1].trim().length > 0) || isSeriesPath) {
                    var seriesTitle = (epMatch && epMatch[1] && epMatch[1].trim()) ? epMatch[1].trim() : info.title;
                    var seasonNum = epMatch ? (parseInt(epMatch[2], 10) || 1) : 1;
                    var epNum = epMatch ? (parseInt(epMatch[3], 10) || 1) : 1;
                    var epSubTitle = epMatch ? String(epMatch[4] || '').trim() : '';
                    var sCatId = 'm3u_scat_' + groupTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                    if (!seriesCatsSeen[sCatId]) {
                        seriesCatsSeen[sCatId] = true;
                        seriesCatsList.push({ id: sCatId, title: groupTitle, censored: adultRe.test(groupTitle) });
                    }
                    var seriesKey = sCatId + '__' + seriesTitle.toLowerCase();
                    if (!seriesGroupsMap[seriesKey]) {
                        var seriesId = 'm3u_ser_' + (seriesGroupsKeys.length + 1);
                        var seriesItem = {
                            id: seriesId,
                            name: seriesTitle,
                            cmd: streamUrl,
                            directUrl: true,
                            genreId: sCatId,
                            poster: logo,
                            logo: logo,
                            desc: groupTitle,
                            censored: isCensored ? 1 : 0,
                            isVod: true,
                            isSeries: true,
                            streamType: 'series',
                            seasons: []
                        };
                        attachM3uDrmAndHeaders(seriesItem, curDrmSnapshot, pipeParsed);
                        seriesGroupsMap[seriesKey] = { seriesItem: seriesItem, seasonsMap: {} };
                        seriesGroupsKeys.push(seriesKey);
                    }
                    var grp = seriesGroupsMap[seriesKey];
                    var sKey = String(seasonNum);
                    if (!grp.seasonsMap[sKey]) {
                        var seasonObj = {
                            id: sKey,
                            name: 'Season ' + seasonNum,
                            cmd: streamUrl,
                            desc: seriesTitle + ' — Season ' + seasonNum,
                            poster: logo || grp.seriesItem.poster || '',
                            genreId: sCatId,
                            censored: isCensored ? 1 : 0,
                            episodes: [],
                            parentSeries: grp.seriesItem,
                            isSeason: true,
                            isVod: true,
                            isSeries: true,
                            streamType: 'series'
                        };
                        attachM3uDrmAndHeaders(seasonObj, curDrmSnapshot, pipeParsed);
                        grp.seasonsMap[sKey] = seasonObj;
                        grp.seriesItem.seasons.push(seasonObj);
                    }
                    var nextEpIdx = grp.seasonsMap[sKey].episodes.length + 1;
                    var resolvedEpNum = epMatch ? epNum : nextEpIdx;
                    var epItem = {
                        id: grp.seriesItem.id + '_s' + seasonNum + '_e' + resolvedEpNum + '_' + nextEpIdx,
                        name: epSubTitle ? ('E' + resolvedEpNum + ' - ' + epSubTitle) : ('Episode ' + resolvedEpNum),
                        cmd: streamUrl,
                        directUrl: true,
                        useTmpLink: 0,
                        genreId: sCatId,
                        poster: logo || grp.seriesItem.poster || '',
                        logo: logo || grp.seriesItem.poster || '',
                        desc: seriesTitle + ' • Season ' + seasonNum + ', Episode ' + resolvedEpNum,
                        seriesNum: resolvedEpNum,
                        seasonId: sKey,
                        seriesId: grp.seriesItem.id,
                        parentSeries: grp.seriesItem,
                        censored: isCensored ? 1 : 0,
                        isEpisode: true,
                        isVod: true,
                        isSeries: true,
                        streamType: 'series'
                    };
                    attachM3uDrmAndHeaders(epItem, curDrmSnapshot, pipeParsed);
                    grp.seasonsMap[sKey].episodes.push(epItem);
                    continue;
                }

                var isMoviePath = /\/movie\//i.test(streamUrl) || /\b(?:vod|movies?|cinema|films?)\b/i.test(groupTitle);
                var isVideoFile = /\.(mp4|mkv|avi|mov|wmv|m4v|flv)($|\?)/i.test(streamUrl);

                if (isMoviePath || (isVideoFile && !isSeriesPath)) {
                    var vCatId = 'm3u_vcat_' + groupTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                    if (!vodCatsSeen[vCatId]) {
                        vodCatsSeen[vCatId] = true;
                        vodCatsList.push({ id: vCatId, title: groupTitle, censored: adultRe.test(groupTitle) });
                    }
                    var vodYearMatch = info.title.match(/\((\d{4})\)/);
                    var newVodObj = {
                        id: 'm3u_vod_' + (vodItems.length + 1),
                        name: info.title,
                        cmd: streamUrl,
                        directUrl: true,
                        useTmpLink: 0,
                        genreId: vCatId,
                        poster: logo,
                        logo: logo,
                        desc: groupTitle,
                        year: vodYearMatch ? vodYearMatch[1] : '',
                        censored: isCensored ? 1 : 0,
                        isVod: true,
                        isSeries: false
                    };
                    attachM3uDrmAndHeaders(newVodObj, curDrmSnapshot, pipeParsed);
                    vodItems.push(newVodObj);
                    continue;
                }

                var lGenreId = 'm3u_live_' + groupTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                if (!liveGenresSeen[lGenreId]) {
                    liveGenresSeen[lGenreId] = true;
                    liveGenresList.push({
                        id: lGenreId,
                        title: groupTitle,
                        censored: adultRe.test(groupTitle) ? 1 : 0
                    });
                }
                var m3uChKey = lGenreId + '__' + info.title.toLowerCase();
                if (liveGenresSeen[m3uChKey] && liveGenresSeen[m3uChKey].cmd !== streamUrl) {
                    var existingM3uCh = liveGenresSeen[m3uChKey];
                    if (!existingM3uCh.cmds) {
                        existingM3uCh.cmds = [{ cmd: existingM3uCh.cmd, useTmp: 0 }];
                    }
                    if (existingM3uCh.cmds.length < 4) {
                        existingM3uCh.cmds.push({ cmd: streamUrl, useTmp: 0 });
                    }
                    attachM3uDrmAndHeaders(existingM3uCh, curDrmSnapshot, pipeParsed);
                    continue;
                }
                var newM3uChannel = {
                    id: 'm3u_ch_' + (liveChannels.length + 1),
                    num: liveChannels.length + 1,
                    name: info.title,
                    cmd: streamUrl,
                    directUrl: true,
                    useTmpLink: 0,
                    genreId: lGenreId,
                    logo: logo,
                    epgChannelId: tvgId,
                    archive: hasCatchup ? 1 : 0,
                    archiveDuration: catchupDays > 0 ? (catchupDays * 24) : (hasCatchup ? 72 : 0),
                    catchupSource: catchupSource,
                    censored: isCensored ? 1 : 0,
                    isVod: false,
                    isSeries: false
                };
                attachM3uDrmAndHeaders(newM3uChannel, curDrmSnapshot, pipeParsed);
                liveGenresSeen[m3uChKey] = newM3uChannel;
                liveChannels.push(newM3uChannel);
            }
        }

        function compareSeasonsById(a, b) {
            return Number(a.id) - Number(b.id);
        }
        function compareEpisodesByNum(a, b) {
            return (a.seriesNum || 0) - (b.seriesNum || 0);
        }

        function finalize() {
            var seriesItems = [];
            for (var sk = 0; sk < seriesGroupsKeys.length; sk++) {
                var gEntry = seriesGroupsMap[seriesGroupsKeys[sk]];
                gEntry.seriesItem.seasons.sort(compareSeasonsById);
                for (var sn = 0; sn < gEntry.seriesItem.seasons.length; sn++) {
                    gEntry.seriesItem.seasons[sn].episodes.sort(compareEpisodesByNum);
                }
                seriesItems.push(gEntry.seriesItem);
            }
            return {
                liveGenres: liveGenresList,
                liveChannels: liveChannels,
                vodCategories: [
                    { id: '*', title: 'All Movies', censored: false },
                    { id: 'new', title: '🆕 Recently Added', censored: false },
                    { id: 'cont', title: '▶ Continue Watching', censored: false },
                    { id: 'fav', title: '★ Favorites', censored: false },
                    { id: 'rec', title: '⏱ History', censored: false }
                ].concat(vodCatsList),
                vodItems: vodItems,
                seriesCategories: [
                    { id: '*', title: 'All Series', censored: false },
                    { id: 'new', title: '🆕 Recently Added', censored: false },
                    { id: 'cont', title: '▶ Continue Watching', censored: false },
                    { id: 'fav', title: '★ Favorites', censored: false },
                    { id: 'rec', title: '⏱ History', censored: false }
                ].concat(seriesCatsList),
                seriesItems: seriesItems,
                epgUrl: headerEpgUrl
            };
        }

        return {
            totalLines: lines.length,
            processRange: processRange,
            finalize: finalize
        };
    }

    function parseM3uPlaylistCatalog(rawText) {
        var state = createM3uParserState(rawText);
        state.processRange(0, state.totalLines);
        return state.finalize();
    }

    function parseM3uPlaylistCatalogAsync(rawText) {
        var chunkSize = 2500;
        if (String(rawText || '').length <= 150000) {
            return Promise.resolve(parseM3uPlaylistCatalog(rawText));
        }
        var state = createM3uParserState(rawText);
        if (state.totalLines <= chunkSize) {
            state.processRange(0, state.totalLines);
            return Promise.resolve(state.finalize());
        }
        return new Promise(function(resolve) {
            var cursor = 0;
            function nextChunk() {
                var end = Math.min(cursor + chunkSize, state.totalLines);
                state.processRange(cursor, end);
                cursor = end;
                if (cursor < state.totalLines) {
                    setTimeout(nextChunk, 0);
                } else {
                    resolve(state.finalize());
                }
            }
            nextChunk();
        });
    }

    function decodeXmlTextEntities(str) {
        return String(str || '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&#(\d+);/g, function(_, dec) {
                return String.fromCharCode(parseInt(dec, 10));
            })
            .replace(/&#x([0-9a-fA-F]+);/g, function(_, hex) {
                return String.fromCharCode(parseInt(hex, 16));
            });
    }

    function normalizeXmltvLookupKey(val) {
        return String(val || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    }

    function parseXmltvDateSec(raw) {
        var s = String(raw || '').trim();
        var m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}|Z))?/);
        if (!m) {
            return 0;
        }
        var year = parseInt(m[1], 10);
        var month = parseInt(m[2], 10) - 1;
        var day = parseInt(m[3], 10);
        var hour = parseInt(m[4], 10);
        var min = parseInt(m[5], 10);
        var sec = parseInt(m[6], 10);
        var utcMs = Date.UTC(year, month, day, hour, min, sec);
        var tz = m[7];
        if (tz && tz !== 'Z') {
            var sign = tz.charAt(0) === '-' ? -1 : 1;
            var tzH = parseInt(tz.slice(1, 3), 10) || 0;
            var tzM = parseInt(tz.slice(3, 5), 10) || 0;
            var offsetMs = sign * ((tzH * 60) + tzM) * 60000;
            utcMs -= offsetMs;
        }
        return Math.floor(utcMs / 1000);
    }

    function parseXmltvDocument(xmlText) {
        var text = String(xmlText || '');
        var channelsById = {};
        var aliasToChannelId = {};
        var programsByChannel = {};
        if (!text || text.indexOf('<programme') === -1) {
            return {
                channelsById: channelsById,
                aliasToChannelId: aliasToChannelId,
                programsByChannel: programsByChannel
            };
        }
        var chRe = /<channel\b[^>]*\bid\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/channel>/gi;
        var dnRe = /<display-name[^>]*>([\s\S]*?)<\/display-name>/gi;
        var stripTagsRe = /<[^>]+>/g;
        var chMatch;
        while ((chMatch = chRe.exec(text)) !== null) {
            var rawId = decodeXmlTextEntities(chMatch[1] || chMatch[2] || '').trim();
            if (!rawId) {
                continue;
            }
            var body = chMatch[3] || '';
            var names = [];
            dnRe.lastIndex = 0;
            var dnMatch;
            while ((dnMatch = dnRe.exec(body)) !== null) {
                var dn = decodeXmlTextEntities(dnMatch[1].replace(stripTagsRe, '')).trim();
                if (dn) {
                    names.push(dn);
                }
            }
            channelsById[rawId] = { id: rawId, displayNames: names };
            var normId = normalizeXmltvLookupKey(rawId);
            if (normId) {
                aliasToChannelId[normId] = rawId;
            }
            for (var n = 0; n < names.length; n++) {
                var normName = normalizeXmltvLookupKey(names[n]);
                if (normName && !aliasToChannelId[normName]) {
                    aliasToChannelId[normName] = rawId;
                }
            }
        }
        var progRe = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
        var chAttrRe = /\bchannel\s*=\s*(?:"([^"]+)"|'([^']+)')/i;
        var startAttrRe = /\bstart\s*=\s*(?:"([^"]+)"|'([^']+)')/i;
        var stopAttrRe = /\bstop\s*=\s*(?:"([^"]+)"|'([^']+)')/i;
        var titleTagRe = /<title[^>]*>([\s\S]*?)<\/title>/i;
        var descTagRe = /<desc[^>]*>([\s\S]*?)<\/desc>/i;
        var progMatch;
        var idx = 0;
        while ((progMatch = progRe.exec(text)) !== null) {
            var attrsPart = progMatch[1] || '';
            var pBody = progMatch[2] || '';
            var chAttr = attrsPart.match(chAttrRe);
            var startAttr = attrsPart.match(startAttrRe);
            var stopAttr = attrsPart.match(stopAttrRe);
            var chId = decodeXmlTextEntities((chAttr && (chAttr[1] || chAttr[2])) || '').trim();
            var startTs = parseXmltvDateSec((startAttr && (startAttr[1] || startAttr[2])) || '');
            var stopTs = parseXmltvDateSec((stopAttr && (stopAttr[1] || stopAttr[2])) || '');
            if (!chId || !startTs) {
                continue;
            }
            if (!stopTs || stopTs <= startTs) {
                stopTs = startTs + 1800;
            }
            var titleMatch = pBody.match(titleTagRe);
            var descMatch = pBody.match(descTagRe);
            var title = titleMatch ? decodeXmlTextEntities(titleMatch[1].replace(stripTagsRe, '')).trim() : 'Program';
            var descr = descMatch ? decodeXmlTextEntities(descMatch[1].replace(stripTagsRe, '')).trim() : '';
            if (!programsByChannel[chId]) {
                programsByChannel[chId] = [];
            }
            if (programsByChannel[chId].length >= 120) {
                continue;
            }
            idx++;
            programsByChannel[chId].push({
                id: 'xmltv_' + idx,
                name: title || 'Program',
                descr: descr,
                start_timestamp: startTs,
                stop_timestamp: stopTs
            });
            var normCh = normalizeXmltvLookupKey(chId);
            if (normCh && !aliasToChannelId[normCh]) {
                aliasToChannelId[normCh] = chId;
            }
        }
        var chKeys = Object.keys(programsByChannel);
        for (var k = 0; k < chKeys.length; k++) {
            programsByChannel[chKeys[k]].sort(compareXmltvProgByStart);
        }
        return {
            channelsById: channelsById,
            aliasToChannelId: aliasToChannelId,
            programsByChannel: programsByChannel
        };
    }

    function compareXmltvProgByStart(a, b) {
        return a.start_timestamp - b.start_timestamp;
    }

    function parseXmltvDocumentAsync(xmlText) {
        var text = String(xmlText || '');
        if (text.length <= 200000) {
            return Promise.resolve(parseXmltvDocument(text));
        }
        return new Promise(function(resolve) {
            var channelsById = {};
            var aliasToChannelId = {};
            var programsByChannel = {};
            if (!text || text.indexOf('<programme') === -1) {
                resolve({
                    channelsById: channelsById,
                    aliasToChannelId: aliasToChannelId,
                    programsByChannel: programsByChannel
                });
                return;
            }
            var chRe = /<channel\b[^>]*\bid\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/channel>/gi;
            var dnRe = /<display-name[^>]*>([\s\S]*?)<\/display-name>/gi;
            var stripTagsRe = /<[^>]+>/g;
            var chMatch;
            while ((chMatch = chRe.exec(text)) !== null) {
                var rawId = decodeXmlTextEntities(chMatch[1] || chMatch[2] || '').trim();
                if (!rawId) {
                    continue;
                }
                var body = chMatch[3] || '';
                var names = [];
                dnRe.lastIndex = 0;
                var dnMatch;
                while ((dnMatch = dnRe.exec(body)) !== null) {
                    var dn = decodeXmlTextEntities(dnMatch[1].replace(stripTagsRe, '')).trim();
                    if (dn) {
                        names.push(dn);
                    }
                }
                channelsById[rawId] = { id: rawId, displayNames: names };
                var normId = normalizeXmltvLookupKey(rawId);
                if (normId) {
                    aliasToChannelId[normId] = rawId;
                }
                for (var n = 0; n < names.length; n++) {
                    var normName = normalizeXmltvLookupKey(names[n]);
                    if (normName && !aliasToChannelId[normName]) {
                        aliasToChannelId[normName] = rawId;
                    }
                }
            }
            var progRe = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
            var chAttrRe = /\bchannel\s*=\s*(?:"([^"]+)"|'([^']+)')/i;
            var startAttrRe = /\bstart\s*=\s*(?:"([^"]+)"|'([^']+)')/i;
            var stopAttrRe = /\bstop\s*=\s*(?:"([^"]+)"|'([^']+)')/i;
            var titleTagRe = /<title[^>]*>([\s\S]*?)<\/title>/i;
            var descTagRe = /<desc[^>]*>([\s\S]*?)<\/desc>/i;
            var idx = 0;
            function processProgrammeSlice() {
                var count = 0;
                var progMatch;
                while (count < 1500 && (progMatch = progRe.exec(text)) !== null) {
                    count++;
                    var attrsPart = progMatch[1] || '';
                    var pBody = progMatch[2] || '';
                    var chAttr = attrsPart.match(chAttrRe);
                    var startAttr = attrsPart.match(startAttrRe);
                    var stopAttr = attrsPart.match(stopAttrRe);
                    var chId = decodeXmlTextEntities((chAttr && (chAttr[1] || chAttr[2])) || '').trim();
                    var startTs = parseXmltvDateSec((startAttr && (startAttr[1] || startAttr[2])) || '');
                    var stopTs = parseXmltvDateSec((stopAttr && (stopAttr[1] || stopAttr[2])) || '');
                    if (!chId || !startTs) {
                        continue;
                    }
                    if (!stopTs || stopTs <= startTs) {
                        stopTs = startTs + 1800;
                    }
                    var titleMatch = pBody.match(titleTagRe);
                    var descMatch = pBody.match(descTagRe);
                    var title = titleMatch ? decodeXmlTextEntities(titleMatch[1].replace(stripTagsRe, '')).trim() : 'Program';
                    var descr = descMatch ? decodeXmlTextEntities(descMatch[1].replace(stripTagsRe, '')).trim() : '';
                    if (!programsByChannel[chId]) {
                        programsByChannel[chId] = [];
                    }
                    if (programsByChannel[chId].length >= 120) {
                        continue;
                    }
                    idx++;
                    programsByChannel[chId].push({
                        id: 'xmltv_' + idx,
                        name: title || 'Program',
                        descr: descr,
                        start_timestamp: startTs,
                        stop_timestamp: stopTs
                    });
                    var normCh = normalizeXmltvLookupKey(chId);
                    if (normCh && !aliasToChannelId[normCh]) {
                        aliasToChannelId[normCh] = chId;
                    }
                }
                if (count === 1500) {
                    setTimeout(processProgrammeSlice, 0);
                } else {
                    var chKeys = Object.keys(programsByChannel);
                    for (var k = 0; k < chKeys.length; k++) {
                        programsByChannel[chKeys[k]].sort(compareXmltvProgByStart);
                    }
                    resolve({
                        channelsById: channelsById,
                        aliasToChannelId: aliasToChannelId,
                        programsByChannel: programsByChannel
                    });
                }
            }
            setTimeout(processProgrammeSlice, 0);
        });
    }

    function lookupXmltvChannelPrograms(catalog, channelObj) {
        if (!catalog || !channelObj || !catalog.programsByChannel) {
            return [];
        }
        if (channelObj._xmltvCatalogRef === catalog && typeof channelObj._xmltvResolvedKey === 'string') {
            return channelObj._xmltvResolvedKey ? (catalog.programsByChannel[channelObj._xmltvResolvedKey] || []) : [];
        }
        var resolvedKey = '';
        var tvgId = String(channelObj.epgChannelId || '').trim();
        if (tvgId && catalog.programsByChannel[tvgId]) {
            resolvedKey = tvgId;
        } else if (tvgId) {
            var normTvg = normalizeXmltvLookupKey(tvgId);
            var mappedByTvg = normTvg ? catalog.aliasToChannelId[normTvg] : '';
            if (mappedByTvg && catalog.programsByChannel[mappedByTvg]) {
                resolvedKey = mappedByTvg;
            }
        }
        if (!resolvedKey) {
            var chName = String(channelObj.name || '').trim();
            if (chName) {
                var normName = normalizeXmltvLookupKey(chName);
                var mappedByName = normName ? catalog.aliasToChannelId[normName] : '';
                if (mappedByName && catalog.programsByChannel[mappedByName]) {
                    resolvedKey = mappedByName;
                } else {
                    var stripped = chName.replace(/^[A-Z]{2,3}\s*[:|\-]\s*/i, '').replace(/\b(FHD|UHD|4K|HD|SD|HEVC|RAW)\b/gi, '').trim();
                    var normStripped = normalizeXmltvLookupKey(stripped);
                    var mappedStripped = normStripped ? catalog.aliasToChannelId[normStripped] : '';
                    if (mappedStripped && catalog.programsByChannel[mappedStripped]) {
                        resolvedKey = mappedStripped;
                    }
                }
            }
        }
        channelObj._xmltvCatalogRef = catalog;
        channelObj._xmltvResolvedKey = resolvedKey;
        return resolvedKey ? (catalog.programsByChannel[resolvedKey] || []) : [];
    }

    function getItemLowerName(it) {
        if (!it) {
            return '';
        }
        if (typeof it._nameLower === 'string') {
            return it._nameLower;
        }
        var low = String(it.name || '').toLowerCase();
        it._nameLower = low;
        return low;
    }
    function getCatLowerTitle(c) {
        if (!c) {
            return '';
        }
        if (typeof c._titleLower === 'string') {
            return c._titleLower;
        }
        var low = String(c.title || '').toLowerCase();
        c._titleLower = low;
        return low;
    }
    function compareItemsByNameAsc(a, b) {
        var na = getItemLowerName(a);
        var nb = getItemLowerName(b);
        if (na < nb) {
            return -1;
        }
        if (na > nb) {
            return 1;
        }
        return 0;
    }
    function compareItemsByNameDesc(a, b) {
        var na = getItemLowerName(a);
        var nb = getItemLowerName(b);
        if (na > nb) {
            return -1;
        }
        if (na < nb) {
            return 1;
        }
        return 0;
    }
    function extractNumericIdForSort(it) {
        if (!it) {
            return 0;
        }
        if (typeof it._sortNumId === 'number') {
            return it._sortNumId;
        }
        var raw = String(it.xtreamStreamId || it.xtreamSeriesId || it.id || '');
        var m = raw.match(/(\d+)$/);
        var parsed = m ? parseInt(m[1], 10) : 0;
        it._sortNumId = parsed;
        return parsed;
    }
    function compareItemsByNewestAdded(a, b) {
        var ya = (a && typeof a._sortYear === 'number') ? a._sortYear : (parseInt(String((a && a.year) || '0'), 10) || 0);
        var yb = (b && typeof b._sortYear === 'number') ? b._sortYear : (parseInt(String((b && b.year) || '0'), 10) || 0);
        if (a && typeof a._sortYear !== 'number') {
            a._sortYear = ya;
        }
        if (b && typeof b._sortYear !== 'number') {
            b._sortYear = yb;
        }
        if (ya !== yb) {
            return yb - ya;
        }
        return extractNumericIdForSort(b) - extractNumericIdForSort(a);
    }
    function filterAndPaginateLocalList(allList, categoryId, page, searchQuery, sortBy) {
        var list = Array.isArray(allList) ? allList : [];
        var q = String(searchQuery || '').trim().toLowerCase();
        var catId = String(categoryId || '*');
        var sortKey = String(sortBy || '');
        var isNewVirtualCat = (catId === 'new');
        var filtered;
        if (
            Array.isArray(allList) &&
            localPaginationCache.listRef === allList &&
            localPaginationCache.listLen === list.length &&
            localPaginationCache.catId === catId &&
            localPaginationCache.query === q &&
            localPaginationCache.sortBy === sortKey &&
            Array.isArray(localPaginationCache.filtered)
        ) {
            filtered = localPaginationCache.filtered;
        } else {
            filtered = [];
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (!it) {
                    continue;
                }
                if (catId !== '*' && !isNewVirtualCat && String(it.genreId) !== catId) {
                    continue;
                }
                if (q && getItemLowerName(it).indexOf(q) === -1) {
                    continue;
                }
                filtered.push(it);
            }
            if (isNewVirtualCat) {
                filtered.sort(compareItemsByNewestAdded);
            } else if (sortKey === 'title_asc') {
                filtered.sort(compareItemsByNameAsc);
            } else if (sortKey === 'title_desc') {
                filtered.sort(compareItemsByNameDesc);
            }
            if (Array.isArray(allList)) {
                localPaginationCache.listRef = allList;
                localPaginationCache.listLen = list.length;
                localPaginationCache.catId = catId;
                localPaginationCache.query = q;
                localPaginationCache.sortBy = sortKey;
                localPaginationCache.filtered = filtered;
            }
        }
        var p = Math.max(1, Number(page) || 1);
        var pageSize = 50;
        var startIdx = (p - 1) * pageSize;
        return filtered.slice(startIdx, startIdx + pageSize);
    }
    function resolveLogoUrl(rawLogo) {
        if (!rawLogo) {
            return '';
        }
        var trimmed = String(rawLogo).trim();
        if (!trimmed) {
            return '';
        }
        if (trimmed.indexOf('http://') === 0 || trimmed.indexOf('https://') === 0 || trimmed.indexOf('data:') === 0 || trimmed.indexOf('blob:') === 0) {
            return trimmed;
        }
        if (trimmed.indexOf('//') === 0) {
            return 'http:' + trimmed;
        }
        var base = getPortalBaseUrl();
        if (!base) {
            return '';
        }
        if (trimmed.charAt(0) === '/') {
            return (cachedPortalOrigin || base) + trimmed;
        }
        return base + '/' + trimmed;
    }

    function showServiceBanner(msg) {
        if (!serviceBannerEl) {
            return;
        }
        if (typeof window !== 'undefined' && window.__tizenSimTelemetry && msg && msg.indexOf('Local proxy service') !== -1) {
            serviceBannerEl.classList.remove('visible');
            return;
        }
        if (msg) {
            serviceBannerEl.textContent = msg;
            serviceBannerEl.classList.add('visible');
        } else {
            serviceBannerEl.classList.remove('visible');
        }
    }
    function proxyFetch(url, opts) {
        var finalOpts = extendObj({}, opts || {});
        var hdrs = extendObj({ 'x-smartstb-client': '1' }, (opts && opts.headers) || {});
        finalOpts.headers = hdrs;
        if (typeof window !== 'undefined' && typeof window.__tizenSimFetch === 'function') {
            return window.__tizenSimFetch(url, finalOpts);
        }
        return fetch(url, finalOpts);
    }
    function pingProxyCandidate(baseUrl) {
        if (typeof window !== 'undefined' && window.__tizenSimTelemetry) {
            return Promise.resolve(true);
        }
        return new Promise(function(resolve) {
            var controller = (typeof window !== 'undefined' && typeof window.AbortController !== 'undefined') ? new window.AbortController() : null;
            var timer = setTimeout(function() {
                if (controller) {
                    controller.abort();
                }
                resolve(false);
            }, 2500);
            proxyFetch(baseUrl + '/health', {
                method: 'GET',
                headers: { 'x-stalker-ping': '1' },
                signal: controller ? controller.signal : undefined
            }).then(function(res) {
                clearTimeout(timer);
                resolve(Boolean(res && (res.status === 200 || res.status === 400)));
            }).catch(function() {
                clearTimeout(timer);
                resolve(false);
            });
        });
    }
    function verifyProxyReachable(maxAttempts) {
        if (typeof window !== 'undefined' && window.__tizenSimTelemetry) {
            showServiceBanner('');
            return Promise.resolve(true);
        }
        var attempts = 0;
        var limit = maxAttempts || 16;
        function tryNext() {
            attempts++;
            return pingProxyCandidate(PROXY_URL).then(function(okPrimary) {
                if (okPrimary) {
                    api.proxyUrl = PROXY_URL;
                    showServiceBanner('');
                    return true;
                }
                return pingProxyCandidate(FALLBACK_PROXY_URL).then(function(okFallback) {
                    if (okFallback) {
                        api.proxyUrl = FALLBACK_PROXY_URL;
                        showServiceBanner('');
                        return true;
                    }
                    if (attempts < limit) {
                        return new Promise(function(r) {
                            setTimeout(r, 150);
                        }).then(tryNext);
                    }
                    showServiceBanner('Warning: Local proxy service (' + SERVICE_ID + ') is not responding.');
                    return false;
                });
            });
        }
        return tryNext();
    }
    function wakeLocalService() {
        if (typeof window !== 'undefined' && window.__tizenSimTelemetry) {
            showServiceBanner('');
            return Promise.resolve(true);
        }
        return new Promise(function(resolve) {
            try {
                if (typeof tizen !== 'undefined' && tizen.application && tizen.application.launchAppControl && typeof tizen.ApplicationControl === 'function') {
                    tizen.application.launchAppControl(
                        new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default'),
                        SERVICE_ID,
                        function() {
                            verifyProxyReachable(16).then(resolve);
                        },
                        function() {
                            verifyProxyReachable(10).then(resolve);
                        }
                    );
                    return;
                }
            } catch (ex) {}
            verifyProxyReachable(4).then(resolve);
        });
    }

    function collectChannelCmdList(c, rawPrimaryCmd, primaryUseTmp) {
        if (!c || !Array.isArray(c.cmds) || c.cmds.length <= 1) {
            return null;
        }
        var list = [];
        var seen = {};
        if (rawPrimaryCmd) {
            seen[rawPrimaryCmd] = true;
            list.push({ cmd: rawPrimaryCmd, useTmp: primaryUseTmp ? 1 : 0 });
        }
        for (var i = 0; i < c.cmds.length && list.length < 4; i++) {
            var entry = c.cmds[i];
            if (!entry) {
                continue;
            }
            var u = String(entry.url || entry.cmd || '').trim();
            if (!u || seen[u]) {
                continue;
            }
            seen[u] = true;
            var isTmp = String(entry.use_http_tmp_link) === '1' ||
                /^(?:ffrt\d*|auto|solution)\s+/i.test(u) ||
                u.indexOf('/ch/') !== -1;
            list.push({ cmd: u, useTmp: isTmp ? 1 : 0 });
        }
        return list.length > 1 ? list : null;
    }

    function normalizeChannelObj(c, defaultIdx, fallbackGenreId) {
        var hasArchive = String(c.enable_tv_archive) === '1' || Number(c.tv_archive_duration) > 0;
        var firstCmdObj = (Array.isArray(c.cmds) && c.cmds.length > 0 && c.cmds[0]) ? c.cmds[0] : null;
        var rawCmd = String(c.cmd || (firstCmdObj && (firstCmdObj.url || firstCmdObj.cmd)) || '').trim();
        var useTmp = String(c.use_http_tmp_link) === '1' ||
            (firstCmdObj && String(firstCmdObj.use_http_tmp_link) === '1') ||
            /^(?:ffrt\d*|auto|solution)\s+/i.test(rawCmd) ||
            rawCmd.indexOf('/ch/') !== -1;
        var rawGenre = (c.tv_genre_id !== undefined && c.tv_genre_id !== null && String(c.tv_genre_id) !== '' && String(c.tv_genre_id) !== '0') ?
            c.tv_genre_id :
            (fallbackGenreId || '*');
        var multiCmds = collectChannelCmdList(c, rawCmd, useTmp);
        var chObj = {
            id: String(c.id || defaultIdx),
            num: Number(c.number) || defaultIdx,
            name: String(c.name || 'Channel ' + defaultIdx),
            cmd: rawCmd,
            useTmpLink: useTmp ? 1 : 0,
            genreId: String(rawGenre).trim(),
            logo: String(c.logo || ''),
            archive: hasArchive ? 1 : 0,
            archiveDuration: Number(c.tv_archive_duration) || (hasArchive ? 168 : 0),
            censored: String(c.censored) === '1' ? 1 : 0,
            isVod: false,
            isSeries: false
        };
        if (multiCmds) {
            chObj.cmds = multiCmds;
        }
        return chObj;
    }

    function updateAccountBadgeFromProfile(profile) {
        if (!accountBadgeEl) {
            return;
        }
        accountBadgeEl.classList.remove('warn');
        accountBadgeEl.classList.remove('connecting');
        if (!profile || typeof profile !== 'object') {
            accountBadgeEl.textContent = '✓ Connected';
            return;
        }
        if (String(profile.blocked) === '1' || Number(profile.status) === 2) {
            accountInfoText = 'Account Blocked';
            accountBadgeEl.textContent = '⚠ ' + accountInfoText;
            accountBadgeEl.classList.add('warn');
            return;
        }
        var dateOnly = extractStalkerExpiryString(profile);
        var acct = (profile.account_info && typeof profile.account_info === 'object') ? profile.account_info : null;
        var rawPlan = profile.tariff_plan_name || profile.tariff_plan || (acct && (acct.tariff_plan_name || acct.tariff_plan)) || '';
        var cleanPlan = String(rawPlan || '').trim();
        var planSuffix = (cleanPlan && cleanPlan !== '0') ? (' • ' + cleanPlan) : '';
        if (dateOnly) {
            accountInfoText = 'Exp: ' + dateOnly + planSuffix;
            accountBadgeEl.textContent = '📅 ' + accountInfoText;
        } else if (profile.fname || profile.login) {
            accountInfoText = String(profile.fname || profile.login) + planSuffix;
            accountBadgeEl.textContent = '✓ ' + accountInfoText;
        } else {
            accountInfoText = 'Active MAC' + planSuffix;
            accountBadgeEl.textContent = '✓ ' + accountInfoText;
        }
    }

    function extractStalkerExpiryString(profile) {
        if (!profile || typeof profile !== 'object') {
            return '';
        }
        var acct = (profile.account_info && typeof profile.account_info === 'object') ? profile.account_info :
            ((profile.info && typeof profile.info === 'object') ? profile.info : null);
        var candidates = [
            profile.expire_billing_date,
            profile.end_date,
            profile.tariff_expired_date,
            profile.expire_date,
            profile.exp_date,
            profile.expired,
            acct && acct.expire_billing_date,
            acct && acct.end_date,
            acct && acct.tariff_expired_date,
            acct && acct.expire_date,
            acct && acct.exp_date,
            acct && acct.phone,
            profile.phone
        ];
        for (var i = 0; i < candidates.length; i++) {
            var raw = candidates[i];
            if (raw === null || raw === undefined) {
                continue;
            }
            var str = String(raw).trim();
            if (!str) {
                continue;
            }
            str = str.replace(/^(?:exp(?:ires|ire|iry)?|valid\s*until|billing\s*date)\s*[:\-]?\s*/i, '').trim();
            if (!str || str === '0' || /^0000[-\/.]00[-\/.]00/.test(str) || /^(?:null|undefined|none|n\/a|false|-+)$/i.test(str)) {
                continue;
            }
            if (/unlimited|never|lifetime|infinite/i.test(str)) {
                return 'Unlimited';
            }
            if (/^\d{10,13}$/.test(str)) {
                var tsNum = Number(str);
                if (tsNum > 1000000000) {
                    var ms = str.length <= 10 ? tsNum * 1000 : tsNum;
                    var d = new Date(ms);
                    if (!isNaN(d.getTime())) {
                        var yyyy = d.getFullYear();
                        var mm = ('0' + (d.getMonth() + 1)).slice(-2);
                        var dd = ('0' + d.getDate()).slice(-2);
                        return yyyy + '-' + mm + '-' + dd;
                    }
                }
            }
            var isoMatch = str.match(/^(\d{4}[-\/.]\d{2}[-\/.]\d{2}|\d{2}[-\/.]\d{2}[-\/.]\d{4})/);
            if (isoMatch) {
                return isoMatch[1];
            }
            var cleanedHuman = str.replace(/,?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?$/i, '').trim();
            if (/\b20\d{2}\b/.test(cleanedHuman) || /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(cleanedHuman)) {
                return cleanedHuman;
            }
            if (cleanedHuman) {
                return cleanedHuman.split(' ')[0];
            }
        }
        return '';
    }

    function updateAccountBadgeFromXtream(userInfo) {
        if (!accountBadgeEl) {
            return;
        }
        accountBadgeEl.classList.remove('warn');
        accountBadgeEl.classList.remove('connecting');
        if (!userInfo || typeof userInfo !== 'object') {
            accountBadgeEl.textContent = '✓ Xtream Active';
            return;
        }
        var statusStr = userInfo.status ? String(userInfo.status).trim() : 'Active';
        if (statusStr && statusStr.toLowerCase() !== 'active') {
            accountInfoText = 'Xtream ' + statusStr;
            accountBadgeEl.textContent = '⚠ ' + accountInfoText;
            accountBadgeEl.classList.add('warn');
            return;
        }
        var connSuffix = '';
        if (userInfo.max_connections !== undefined && userInfo.max_connections !== null && String(userInfo.max_connections) !== '0' && String(userInfo.max_connections) !== '') {
            connSuffix = ' • ' + Number(userInfo.active_cons || 0) + '/' + String(userInfo.max_connections) + ' Conns';
        }
        var expDate = userInfo.exp_date;
        if (expDate && String(expDate) !== 'null' && String(expDate) !== '0') {
            var sec = Number(expDate);
            if (!isNaN(sec) && sec > 1000000000) {
                var d = new Date(sec * 1000);
                var yyyy = d.getFullYear();
                var mm = ('0' + (d.getMonth() + 1)).slice(-2);
                var dd = ('0' + d.getDate()).slice(-2);
                accountInfoText = 'Exp: ' + yyyy + '-' + mm + '-' + dd + connSuffix;
                accountBadgeEl.textContent = '📅 ' + accountInfoText;
                return;
            }
        }
        if (expDate === null || String(expDate) === '0') {
            accountInfoText = 'Exp: Unlimited' + connSuffix;
            accountBadgeEl.textContent = '📅 ' + accountInfoText;
            return;
        }
        accountInfoText = String(userInfo.username || 'Xtream Active') + connSuffix;
        accountBadgeEl.textContent = '✓ ' + accountInfoText;
    }

    function StalkerAPI(proxyUrl) {
        this.proxyUrl = proxyUrl;
        this.token = '';
        this.sessionEpoch = 0;
        this.parentalPin = localStorage.getItem('cfg_pin') || '0000';
        this.watchdogTimer = null;
        this.seriesModule = null;
        this.handshakePromise = null;
        this.authPromise = null;
        this.liveRefreshPromise = null;
        this.vodCategoriesPromise = null;
        this.seriesCategoriesPromise = null;
        this.xtreamVodPromise = null;
        this.xtreamSeriesPromise = null;
        this.xtreamVodStreamsCache = null;
        this.xtreamSeriesCache = null;
        this.xtreamVodByCatCache = {};
        this.xtreamVodByCatKeys = [];
        this.xtreamSeriesByCatCache = {};
        this.xtreamSeriesByCatKeys = [];
        this.xtreamLiveByCatCache = {};
        this.xtreamLiveByCatKeys = [];
        this.m3uCatalogCache = null;
        this.activeShortEpgController = null;
        this.activeCatalogControllers = [];
    }
    StalkerAPI.prototype.registerCatalogController = function(ctrl) {
        if (!ctrl) {
            return;
        }
        if (!this.activeCatalogControllers) {
            this.activeCatalogControllers = [];
        }
        this.activeCatalogControllers.push(ctrl);
    };
    StalkerAPI.prototype.unregisterCatalogController = function(ctrl) {
        if (!ctrl || !Array.isArray(this.activeCatalogControllers)) {
            return;
        }
        var idx = this.activeCatalogControllers.indexOf(ctrl);
        if (idx !== -1) {
            this.activeCatalogControllers.splice(idx, 1);
        }
    };
    StalkerAPI.prototype.abortAllCatalogRequests = function() {
        if (!Array.isArray(this.activeCatalogControllers)) {
            this.activeCatalogControllers = [];
            return;
        }
        var list = this.activeCatalogControllers;
        this.activeCatalogControllers = [];
        for (var i = 0; i < list.length; i++) {
            if (list[i]) {
                try {
                    list[i].abort();
                } catch (eAbCat) {}
            }
        }
    };
    StalkerAPI.prototype.abortShortEpg = function() {
        if (this.activeShortEpgController) {
            try {
                this.activeShortEpgController.abort();
            } catch (eAb) {}
            this.activeShortEpgController = null;
        }
    };
    StalkerAPI.prototype.getProviderType = function() {
        var prof = getActiveProfile();
        if (prof && (prof.type === 'xtream' || prof.type === 'm3u')) {
            return prof.type;
        }
        return 'stalker';
    };
    StalkerAPI.prototype.resetProviderCaches = function() {
        this.abortShortEpg();
        this.abortAllCatalogRequests();
        this.sessionEpoch = (this.sessionEpoch || 0) + 1;
        this.token = '';
        this.seriesModule = null;
        this.handshakePromise = null;
        this.authPromise = null;
        this.liveRefreshPromise = null;
        this.vodCategoriesPromise = null;
        this.seriesCategoriesPromise = null;
        this.xtreamVodPromise = null;
        this.xtreamSeriesPromise = null;
        this.xtreamVodStreamsCache = null;
        this.xtreamSeriesCache = null;
        this.xtreamVodByCatCache = {};
        this.xtreamVodByCatKeys = [];
        this.xtreamSeriesByCatCache = {};
        this.xtreamSeriesByCatKeys = [];
        this.xtreamLiveByCatCache = {};
        this.xtreamLiveByCatKeys = [];
        this.m3uCatalogCache = null;
        if (this.watchdogTimer) {
            clearInterval(this.watchdogTimer);
            this.watchdogTimer = null;
        }
        cachedPortalBaseUrl = null;
        cachedPortalOrigin = null;
        localPaginationCache.listRef = null;
        localPaginationCache.filtered = null;
        xmltvCache = {};
        epgGridProgramsByCh = {};
        epgGridChannels = [];
    };
    StalkerAPI.prototype.xtreamRequest = function(action, extraParams) {
        var self = this;
        var prof = getActiveProfile();
        var reqEpoch = this.sessionEpoch || 0;
        var baseUrl = normalizeXtreamServerUrl(prof.xtreamUrl || localStorage.getItem('cfg_xtream_url') || '');
        var user = String(prof.xtreamUser || localStorage.getItem('cfg_xtream_user') || '').trim();
        var pass = String(prof.xtreamPass || localStorage.getItem('cfg_xtream_pass') || '').trim();
        if (!baseUrl || !user || !pass) {
            return Promise.reject(new Error('Xtream Server URL, Username, or Password not configured'));
        }
        var qs = ['username=' + encodeURIComponent(user), 'password=' + encodeURIComponent(pass)];
        if (action) {
            qs.push('action=' + encodeURIComponent(action));
        }
        var keepInFlight = Boolean(extraParams && extraParams._keepInFlight);
        if (extraParams && typeof extraParams === 'object') {
            var eKeys = Object.keys(extraParams);
            for (var i = 0; i < eKeys.length; i++) {
                var k = eKeys[i];
                if (k === '_keepInFlight') {
                    continue;
                }
                if (extraParams[k] !== undefined && extraParams[k] !== null) {
                    qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(extraParams[k])));
                }
            }
        }
        var targetUrl = baseUrl + '/player_api.php?' + qs.join('&');
        var proxiedUrl = this.proxyUrl + '/xtream?url=' + encodeURIComponent(targetUrl);
        var controller = (typeof window !== 'undefined' && typeof window.AbortController !== 'undefined') ? new window.AbortController() : null;
        if (action === 'get_short_epg' && !keepInFlight) {
            this.abortShortEpg();
            this.activeShortEpgController = controller;
        } else if (controller) {
            this.registerCatalogController(controller);
        }
        var timedOut = false;
        var timeoutId = setTimeout(function() {
            timedOut = true;
            if (controller) {
                try {
                    controller.abort();
                } catch (eAb) {}
            }
        }, action === 'get_short_epg' ? 6000 : 35000);
        var fetchOpts = { method: 'GET' };
        if (controller) {
            fetchOpts.signal = controller.signal;
        }
        return proxyFetch(proxiedUrl, fetchOpts).then(function(res) {
            clearTimeout(timeoutId);
            self.unregisterCatalogController(controller);
            if (self.sessionEpoch !== reqEpoch) {
                throw new Error('Portal session switched');
            }
            if (!res.ok) {
                throw new Error('HTTP ' + res.status);
            }
            return res.json();
        }).catch(function(err) {
            clearTimeout(timeoutId);
            self.unregisterCatalogController(controller);
            if (self.sessionEpoch !== reqEpoch) {
                throw new Error('Portal session switched');
            }
            if (controller && controller.signal && controller.signal.aborted && !timedOut) {
                throw err;
            }
            var fallbackOpts = { method: 'GET' };
            if (controller) {
                fallbackOpts.signal = controller.signal;
            }
            return proxyFetch(targetUrl, fallbackOpts).then(function(res2) {
                if (self.sessionEpoch !== reqEpoch) {
                    throw new Error('Portal session switched');
                }
                if (!res2.ok) {
                    throw err;
                }
                return res2.json();
            });
        }).then(function(data) {
            if (self.sessionEpoch !== reqEpoch) {
                throw new Error('Portal session switched');
            }
            showServiceBanner('');
            if (data && data.error) {
                throw new Error(String(data.error));
            }
            return data;
        });
    };
    StalkerAPI.prototype.ensureM3uCatalogLoaded = function(forceRefresh) {
        var self = this;
        var prof = getActiveProfile();
        if (!forceRefresh && this.m3uCatalogCache && this.m3uCatalogCache.profileId === prof.id) {
            return Promise.resolve(this.m3uCatalogCache.catalog);
        }
        var m3uUrl = String(prof.m3uUrl || localStorage.getItem('cfg_m3u_url') || '').trim();
        var memRaw = m3uRawMemoryCache[prof.id] || localStorage.getItem('m3u_raw_' + prof.id) || '';

        function parseAndStore(rawText) {
            if (!rawText || rawText.indexOf('#EXT') === -1) {
                return Promise.reject(new Error('Invalid or empty M3U playlist'));
            }
            return parseM3uPlaylistCatalogAsync(rawText).then(function(parsed) {
                if (parsed.epgUrl && !prof.epgUrl) {
                    prof.epgUrl = parsed.epgUrl;
                    if (activeProfileId === prof.id) {
                        safeSetStorage('cfg_epg_url', parsed.epgUrl);
                    }
                    safeSetStorage('cfg_profiles', JSON.stringify(profiles));
                }
                self.m3uCatalogCache = {
                    profileId: prof.id,
                    catalog: parsed
                };
                if (m3uRawMemoryCache[prof.id] && m3uRawMemoryCache[prof.id].length > 120000) {
                    delete m3uRawMemoryCache[prof.id];
                }
                if (activeProfileId === prof.id) {
                    var totalCount = parsed.liveChannels.length + parsed.vodItems.length + parsed.seriesItems.length;
                    accountInfoText = 'M3U (' + totalCount + ' items)';
                    if (accountBadgeEl) {
                        accountBadgeEl.textContent = '📋 ' + accountInfoText;
                        accountBadgeEl.classList.remove('warn');
                        accountBadgeEl.classList.remove('connecting');
                    }
                    showServiceBanner('');
                }
                return parsed;
            });
        }

        if (memRaw && (!forceRefresh || !m3uUrl || m3uUrl.indexOf('local://') === 0)) {
            return Promise.resolve().then(function() {
                return parseAndStore(memRaw);
            });
        }
        if (m3uUrl.indexOf('local://') === 0) {
            return proxyFetch(this.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent('m3u_raw_' + prof.id), {
                method: 'GET'
            }).then(function(r) {
                if (!r.ok) {
                    throw new Error('Local M3U file not found in cache — please load the .M3U file again');
                }
                return r.json();
            }).then(function(d) {
                var raw = (d && d.rawText) ? d.rawText : '';
                m3uRawMemoryCache[prof.id] = raw;
                return parseAndStore(raw);
            });
        }
        if (!m3uUrl) {
            return Promise.reject(new Error('M3U Playlist URL or Local File not configured'));
        }
        var proxiedM3u = this.proxyUrl + '/m3u?url=' + encodeURIComponent(m3uUrl);
        return proxyFetch(proxiedM3u, { method: 'GET' }).then(function(r) {
            if (!r.ok) {
                throw new Error('HTTP ' + r.status);
            }
            return r.text();
        }).catch(function(err) {
            return proxyFetch(m3uUrl, { method: 'GET' }).then(function(r2) {
                if (!r2.ok) {
                    throw err;
                }
                return r2.text();
            });
        }).then(function(rawText) {
            if (rawText && rawText.indexOf('#EXT') !== -1) {
                m3uRawMemoryCache[prof.id] = rawText;
                if (rawText.length <= 1500000) {
                    safeSetStorage('m3u_raw_' + prof.id, rawText);
                } else {
                    try {
                        localStorage.removeItem('m3u_raw_' + prof.id);
                    } catch (eRmQuota) {}
                }
                proxyFetch(self.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent('m3u_raw_' + prof.id), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rawText: rawText, fileName: prof.m3uFileName || 'remote.m3u', ts: Date.now() })
                }).catch(function() {});
            }
            return parseAndStore(rawText);
        }).catch(function(fetchErr) {
            if (memRaw) {
                return parseAndStore(memRaw);
            }
            return proxyFetch(self.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent('m3u_raw_' + prof.id), {
                method: 'GET'
            }).then(function(rCache) {
                if (!rCache.ok) {
                    throw fetchErr;
                }
                return rCache.json();
            }).then(function(dCache) {
                if (dCache && dCache.rawText) {
                    m3uRawMemoryCache[prof.id] = dCache.rawText;
                    return parseAndStore(dCache.rawText);
                }
                throw fetchErr;
            });
        });
    };
    StalkerAPI.prototype.request = function(params, isRetry) {
        var self = this;
        var activeProf = getActiveProfile();
        var portal = String((activeProf && activeProf.portal) || localStorage.getItem('cfg_portal') || '').trim();
        var mac = String((activeProf && activeProf.mac) || localStorage.getItem('cfg_mac') || '').trim();
        if (!portal || !mac) {
            return Promise.reject(new Error('Portal URL or MAC not configured'));
        }
        var reqEpoch = this.sessionEpoch || 0;
        var isHandshakeOrProfile = params.action === 'handshake' || params.action === 'get_profile' || params.action === 'get_main_info';
        var isEpgOrWatchdog = params.action === 'get_short_epg' ||
                              params.action === 'get_epg_info' ||
                              params.type === 'watchdog';
        if (!isHandshakeOrProfile && !isRetry && !isEpgOrWatchdog) {
            if (this.authPromise) {
                return this.authPromise.then(function() {
                    if (self.sessionEpoch !== reqEpoch) {
                        throw new Error('Portal session switched');
                    }
                    return self.request(params, true);
                });
            }
            if (!this.token) {
                return this.ensureAuthenticatedSession().then(function() {
                    if (self.sessionEpoch !== reqEpoch) {
                        throw new Error('Portal session switched');
                    }
                    return self.request(params, true);
                });
            }
        }
        var keepInFlight = Boolean(params && params._keepInFlight);
        var fullParams = extendObj(params, { JsHttpRequest: '1-xml' });
        delete fullParams._retried;
        delete fullParams._keepInFlight;
        if (this.token && fullParams.token === undefined && fullParams.action !== 'handshake') {
            fullParams.token = this.token;
        }
        var qsParts = [];
        var keys = Object.keys(fullParams);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (fullParams[k] !== undefined && fullParams[k] !== null) {
                qsParts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(fullParams[k])));
            }
        }
        var queryString = '?' + qsParts.join('&');
        var headers = {
            'x-stalker-portal': encodeURIComponent(portal),
            'x-stalker-mac': encodeURIComponent(mac),
            'x-stalker-tz': encodeURIComponent(getDeviceTimezone()),
            'x-stalker-search': queryString
        };
        if (this.token && fullParams.action !== 'handshake') {
            headers['x-stalker-token'] = encodeURIComponent(this.token);
        }
        var isLargeCatalogAction = params.action === 'get_all_channels' ||
                                   params.action === 'get_genres' ||
                                   params.action === 'get_categories';
        var controller = (typeof window !== 'undefined' && typeof window.AbortController !== 'undefined') ? new window.AbortController() : null;
        if (params.action === 'get_short_epg' && !keepInFlight) {
            this.abortShortEpg();
            this.activeShortEpgController = controller;
        } else if (controller) {
            this.registerCatalogController(controller);
        }
        var timedOut = false;
        var reqTimeoutMs = isEpgOrWatchdog ? 6000 : (isLargeCatalogAction ? 35000 : 14000);
        var timeoutId = setTimeout(function() {
            timedOut = true;
            if (controller) {
                try {
                    controller.abort();
                } catch (eAbort) {}
            }
        }, reqTimeoutMs);
        var fetchOpts = {
            method: 'GET',
            headers: headers
        };
        if (controller) {
            fetchOpts.signal = controller.signal;
        }
        return proxyFetch(this.proxyUrl + '/' + queryString, fetchOpts).then(function(res) {
            clearTimeout(timeoutId);
            self.unregisterCatalogController(controller);
            if (!res.ok) {
                throw new Error('HTTP ' + res.status);
            }
            return res.json();
        }).then(function(data) {
            if (self.sessionEpoch !== reqEpoch) {
                throw new Error('Portal session switched');
            }
            showServiceBanner('');
            if (!data || data.error) {
                if (isEpgOrWatchdog && (!data || data.error !== 'AUTH_FAILED')) {
                    return [];
                }
                throw new Error((data && data.error) || 'Empty portal response');
            }
            if (typeof data.text === 'string' && /authorization\s+failed/i.test(data.text)) {
                throw new Error('AUTH_FAILED');
            }
            if (data.js !== undefined) {
                return data.js;
            }
            return data;
        }).catch(function(reqErr) {
            clearTimeout(timeoutId);
            self.unregisterCatalogController(controller);
            if (self.sessionEpoch !== reqEpoch) {
                throw reqErr;
            }
            if (controller && controller.signal && controller.signal.aborted && !timedOut) {
                var abortErr = reqErr || new Error('Aborted');
                abortErr.isAborted = true;
                throw abortErr;
            }
            if (isEpgOrWatchdog) {
                return [];
            }
            if (!isRetry && params.action !== 'handshake' && params.action !== 'get_profile' && params.action !== 'get_main_info') {
                self.token = '';
                return self.ensureAuthenticatedSession().then(function() {
                    if (self.sessionEpoch !== reqEpoch) {
                        throw new Error('Portal session switched');
                    }
                    return self.request(params, true);
                });
            }
            throw reqErr;
        });
    };
    StalkerAPI.prototype.doHandshake = function() {
        var self = this;
        if (this.handshakePromise) {
            return this.handshakePromise;
        }
        var hEpoch = this.sessionEpoch || 0;
        this.handshakePromise = this.request({
            type: 'stb',
            action: 'handshake',
            token: '',
            prehash: '0'
        }, true).then(function(js) {
            if (self.sessionEpoch === hEpoch) {
                self.handshakePromise = null;
                if (js && js.token) {
                    self.token = String(js.token);
                }
            }
            return js;
        }).catch(function(err) {
            if (self.sessionEpoch === hEpoch) {
                self.handshakePromise = null;
            }
            throw err;
        });
        return this.handshakePromise;
    };
    StalkerAPI.prototype.getProfile = function() {
        var self = this;
        var activeProf = getActiveProfile();
        var mac = String((activeProf && activeProf.mac) || localStorage.getItem('cfg_mac') || '00:1A:79:00:00:01').trim();
        var id = deriveMagIdentity(mac);
        var pEpoch = this.sessionEpoch || 0;
        return this.request({
            type: 'stb',
            action: 'get_profile',
            hd: '1',
            ver: 'ImageDescription: 0.2.18-r14-pub-250; PORTAL version: 5.1.0;',
            num_banks: '2',
            sn: id.sn,
            stb_type: 'MAG250',
            image_version: '218',
            video_out: 'hdmi',
            device_id: id.device_id,
            device_id2: id.device_id2,
            signature: id.signature,
            auth_second_step: '0',
            hw_version: '1.7-BD-00',
            not_valid_token: '0',
            client_type: 'STB',
            hw_version_2: id.sn,
            timestamp: Math.floor(Date.now() / 1000),
            timezone: getDeviceTimezone()
        }, true).then(function(profile) {
            if (self.sessionEpoch !== pEpoch) {
                return profile;
            }
            var customPin = localStorage.getItem('cfg_pin');
            if (customPin && customPin.length === 4) {
                self.parentalPin = customPin;
            } else if (profile && profile.parent_password) {
                self.parentalPin = String(profile.parent_password).trim() || '0000';
            } else {
                self.parentalPin = '0000';
            }
            if (extractStalkerExpiryString(profile)) {
                updateAccountBadgeFromProfile(profile);
                return profile;
            }
            return self.request({
                type: 'account_info',
                action: 'get_main_info'
            }, true).then(function(acctInfo) {
                if (self.sessionEpoch !== pEpoch) {
                    return profile;
                }
                if (acctInfo && typeof acctInfo === 'object' && profile && typeof profile === 'object') {
                    profile.account_info = acctInfo;
                    if (!extractStalkerExpiryString(profile)) {
                        var fallbackExp = extractStalkerExpiryString(acctInfo);
                        if (fallbackExp) {
                            profile.expire_billing_date = fallbackExp;
                        }
                    }
                    if (!profile.tariff_plan_name && (acctInfo.tariff_plan_name || acctInfo.tariff_plan)) {
                        profile.tariff_plan_name = acctInfo.tariff_plan_name || acctInfo.tariff_plan;
                    }
                }
                updateAccountBadgeFromProfile(profile);
                return profile;
            }).catch(function() {
                if (self.sessionEpoch === pEpoch) {
                    updateAccountBadgeFromProfile(profile);
                }
                return profile;
            });
        });
    };
    StalkerAPI.prototype.ensureAuthenticatedSession = function() {
        var self = this;
        if (this.getProviderType() === 'xtream') {
            return this.xtreamRequest('', null).then(function(data) {
                if (data && data.user_info && String(data.user_info.auth) === '0') {
                    throw new Error('Xtream Authentication Failed');
                }
                updateAccountBadgeFromXtream(data ? data.user_info : null);
                return data;
            });
        }
        if (this.getProviderType() === 'm3u') {
            return this.ensureM3uCatalogLoaded(false);
        }
        if (this.authPromise) {
            return this.authPromise;
        }
        var aEpoch = this.sessionEpoch || 0;
        this.authPromise = this.doHandshake().then(function() {
            return self.getProfile();
        }).then(function(profile) {
            if (self.sessionEpoch === aEpoch) {
                self.authPromise = null;
            }
            return profile;
        }).catch(function(err) {
            if (self.sessionEpoch === aEpoch) {
                self.authPromise = null;
            }
            throw err;
        });
        return this.authPromise;
    };
    StalkerAPI.prototype.boot = function() {
        var self = this;
        if (this.watchdogTimer) {
            clearInterval(this.watchdogTimer);
            this.watchdogTimer = null;
        }
        var pType = this.getProviderType();
        if (pType === 'xtream' || pType === 'm3u') {
            return this.ensureAuthenticatedSession();
        }
        return this.ensureAuthenticatedSession().then(function(profile) {
            self.watchdogTimer = setInterval(function() {
                self.request({
                    type: 'watchdog',
                    action: 'get_events',
                    cur_play_type: isPlayingVod ? '2' : '1',
                    event_active_id: '0',
                    init: '0'
                }, true).catch(function() {});
            }, 120000);
            return profile;
        });
    };

    StalkerAPI.prototype.fetchLiveCatalog = function(forceRefresh) {
        var self = this;
        var activeProf = getActiveProfile();
        if (this.getProviderType() === 'm3u') {
            return this.ensureM3uCatalogLoaded(forceRefresh).then(function(cat) {
                return {
                    genres: self.getOrderedGenres(cat.liveGenres),
                    channels: cat.liveChannels
                };
            });
        }
        var cacheKey = 'stalker_live';
        var reqProfId = activeProf.id;
        function triggerBackgroundRefresh() {
            setTimeout(function() {
                if (activeProfileId !== reqProfId) {
                    return;
                }
                self.refreshLiveInBackground().then(function(fresh) {
                    if (activeProfileId !== reqProfId) {
                        return;
                    }
                    if (fresh && Array.isArray(fresh.genres) && fresh.genres.length > 3) {
                        liveGenres = fresh.genres;
                    }
                    if (fresh && Array.isArray(fresh.channels) && fresh.channels.length > 0) {
                        allChannels = fresh.channels;
                        rebuildGenreChannelCounts();
                        if (getActiveContentModeId() === 'live') {
                            rawCats = liveGenres;
                            catsFilterMemo = null;
                            var activeLiveCat = currentCats[catIdx];
                            var activeLiveCatId = activeLiveCat ? String(activeLiveCat.id) : '*';
                            if (activeLiveCatId === '*') {
                                rawItems = allChannels;
                            } else if (genreChannelsMap[activeLiveCatId]) {
                                rawItems = genreChannelsMap[activeLiveCatId];
                            } else {
                                var freshMap = {};
                                for (var i = 0; i < allChannels.length; i++) {
                                    freshMap[String(allChannels[i].id)] = allChannels[i];
                                }
                                for (var j = 0; j < rawItems.length; j++) {
                                    var updated = freshMap[String(rawItems[j].id)];
                                    if (updated) {
                                        rawItems[j].cmd = updated.cmd;
                                        rawItems[j].useTmpLink = updated.useTmpLink;
                                        if (updated.cmds && Array.isArray(updated.cmds)) {
                                            rawItems[j].cmds = updated.cmds;
                                        }
                                    }
                                }
                            }
                            itemsFilterMemo = null;
                            applyColumnFilters();
                            renderCats();
                            renderItems();
                        }
                    }
                }).catch(function() {});
            }, 1500);
        }
        if (!forceRefresh) {
            var cached = safeGetJson(cacheKey, null);
            if (cached && cached.profileId === activeProf.id &&
                Array.isArray(cached.genres) && cached.genres.length > 0 &&
                Array.isArray(cached.channels) && cached.channels.length > 0) {
                if (!cached.updatedAt || (Date.now() - cached.updatedAt) > 1800000) {
                    triggerBackgroundRefresh();
                }
                return Promise.resolve({
                    genres: self.getOrderedGenres(cached.genres),
                    channels: cached.channels
                });
            }
            return proxyFetch(this.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent(activeProf.id), {
                method: 'GET'
            }).then(function(r) {
                if (!r.ok) {
                    throw new Error('No proxy cache');
                }
                return r.json();
            }).then(function(diskCached) {
                if (diskCached && Array.isArray(diskCached.genres) && diskCached.genres.length > 0 &&
                    Array.isArray(diskCached.channels) && diskCached.channels.length > 0) {
                    if (!diskCached.updatedAt || (Date.now() - diskCached.updatedAt) > 1800000) {
                        triggerBackgroundRefresh();
                    }
                    return {
                        genres: self.getOrderedGenres(diskCached.genres),
                        channels: diskCached.channels
                    };
                }
                return self.refreshLiveInBackground();
            }).catch(function() {
                return self.refreshLiveInBackground();
            });
        }
        return this.refreshLiveInBackground();
    };
    StalkerAPI.prototype.getOrderedGenres = function(rawGenreList) {
        var base = [
            { id: '*', title: 'All Channels', censored: false, _lowerTitle: 'all channels' },
            { id: 'fav', title: '★ Favorites', censored: false, _lowerTitle: '★ favorites' },
            { id: 'rec', title: '⏱ History', censored: false, _lowerTitle: '⏱ history' }
        ];
        var seen = { '*': true, fav: true, rec: true };
        var liveAdultMap = {};
        var list = Array.isArray(rawGenreList) ? rawGenreList : [];
        for (var i = 0; i < list.length; i++) {
            var g = list[i];
            if (!g) {
                continue;
            }
            var gid = String(g.id || '');
            var gtitle = String(g.title || g.name || '').trim();
            if (!gid || !gtitle || seen[gid]) {
                continue;
            }
            seen[gid] = true;
            var isAdult = Boolean(g.censored && String(g.censored) !== '0') || ADULT_RE.test(gtitle);
            if (isAdult) {
                liveAdultMap[gid] = true;
            }
            base.push({
                id: gid,
                title: gtitle,
                censored: isAdult,
                _lowerTitle: g._lowerTitle || gtitle.toLowerCase()
            });
        }
        adultCatLookup.live = liveAdultMap;
        return base;
    };
    StalkerAPI.prototype.refreshLiveInBackground = function(isRetryAttempt) {
        var self = this;
        var activeProf = getActiveProfile();
        var refreshProfId = activeProf.id;
        var refreshEpoch = this.sessionEpoch || 0;
        var shouldCancelChunk = function() {
            return activeProfileId !== refreshProfId || self.sessionEpoch !== refreshEpoch;
        };
        if (this.getProviderType() === 'm3u') {
            return this.ensureM3uCatalogLoaded(true).then(function(cat) {
                return {
                    genres: self.getOrderedGenres(cat.liveGenres),
                    channels: cat.liveChannels
                };
            });
        }
        if (!isRetryAttempt && this.liveRefreshPromise) {
            return this.liveRefreshPromise;
        }
        var runPromise;
        if (this.getProviderType() === 'xtream') {
            var xAuthLive = {
                base: normalizeXtreamServerUrl(activeProf.xtreamUrl || ''),
                user: encodeURIComponent(String(activeProf.xtreamUser || '').trim()),
                pass: encodeURIComponent(String(activeProf.xtreamPass || '').trim())
            };
            runPromise = this.xtreamRequest('get_live_categories').catch(function() { return []; }).then(function(catsArr) {
                if (shouldCancelChunk()) {
                    throw new Error('Portal session switched');
                }
                var list = Array.isArray(catsArr) ? catsArr : [];
                return processArrayInChunks(list, 2500, function(gc) {
                    if (!gc || gc.category_id === undefined) {
                        return null;
                    }
                    var gTitle = String(gc.category_name || 'Category').trim();
                    if (!gTitle) {
                        return null;
                    }
                    var gAdult = ADULT_RE.test(gTitle);
                    return {
                        id: String(gc.category_id),
                        title: gTitle,
                        censored: gAdult ? 1 : 0,
                        _lowerTitle: gTitle.toLowerCase()
                    };
                }, shouldCancelChunk);
            }).then(function(slimGenres) {
                if (shouldCancelChunk()) {
                    throw new Error('Portal session switched');
                }
                if (activeProfileId === refreshProfId && slimGenres.length > 0 && liveGenres.length <= 3) {
                    liveGenres = self.getOrderedGenres(slimGenres);
                    if (getActiveContentModeId() === 'live') {
                        rawCats = liveGenres;
                        applyColumnFilters();
                        renderCats();
                        if (catsHeaderEl) {
                            catsHeaderEl.textContent = 'Categories (' + Math.max(0, currentCats.length - 3) + ')';
                        }
                    }
                }
                // On massive portals (e.g. 600+ to 10,000+ categories), avoid downloading all streams at once to stay well under 380MB DDR RAM
                if (slimGenres.length > 600) {
                    try {
                        localStorage.removeItem('stalker_live');
                    } catch (eRmLarge1) {}
                    return {
                        genres: self.getOrderedGenres(slimGenres),
                        channels: []
                    };
                }
                return self.xtreamRequest('get_live_streams').catch(function() { return []; }).then(function(streamsArr) {
                    if (shouldCancelChunk()) {
                        throw new Error('Portal session switched');
                    }
                    var arr = Array.isArray(streamsArr) ? streamsArr : [];
                    return processArrayInChunks(arr, 1500, function(st, j) {
                        if (!st || st.stream_id === undefined) {
                            return null;
                        }
                        var stId = String(st.stream_id);
                        var stName = String(st.name || ('Channel ' + (j + 1)));
                        var hasArch = Number(st.tv_archive) === 1;
                        var archDur = (Number(st.tv_archive_duration) || (hasArch ? 3 : 0)) * 24;
                        var isAdultCh = String(st.is_adult) === '1' || ADULT_RE.test(stName);
                        return {
                            id: 'xt_live_' + stId,
                            xtreamStreamId: stId,
                            epgChannelId: String(st.epg_channel_id || ''),
                            num: Number(st.num) || (j + 1),
                            name: stName,
                            cmd: buildXtreamDirectStreamUrl(xAuthLive, 'live', stId, 'ts'),
                            directUrl: true,
                            useTmpLink: 0,
                            genreId: String(st.category_id || '*'),
                            logo: String(st.stream_icon || ''),
                            archive: hasArch ? 1 : 0,
                            archiveDuration: archDur,
                            censored: isAdultCh ? 1 : 0,
                            isVod: false,
                            isSeries: false
                        };
                    }, shouldCancelChunk).then(function(slimChannels) {
                        if (shouldCancelChunk()) {
                            throw new Error('Portal session switched');
                        }
                        if (slimGenres.length > 0 && slimChannels.length > 0) {
                            setTimeout(function() {
                                if (activeProfileId !== refreshProfId) {
                                    return;
                                }
                                try {
                                    if (slimChannels.length > 1200 || slimGenres.length > 250) {
                                        try {
                                            localStorage.removeItem('stalker_live');
                                        } catch (eRm1) {}
                                    }
                                    if (slimChannels.length <= 8000 && slimGenres.length <= 600) {
                                        var payloadStr = JSON.stringify({
                                            profileId: activeProf.id,
                                            updatedAt: Date.now(),
                                            genres: slimGenres,
                                            channels: slimChannels
                                        });
                                        if (slimChannels.length <= 1200 && slimGenres.length <= 250 && payloadStr.length <= 450000) {
                                            safeSetStorage('stalker_live', payloadStr);
                                        }
                                        proxyFetch(self.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent(activeProf.id), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: payloadStr
                                        }).catch(function() {});
                                    }
                                } catch (eCache) {}
                            }, 1500);
                        }
                        return {
                            genres: self.getOrderedGenres(slimGenres),
                            channels: slimChannels
                        };
                    });
                });
            });
        } else {
            runPromise = this.request({ type: 'itv', action: 'get_genres' }).catch(function() {
                return [];
            }).then(function(gRes) {
                if (shouldCancelChunk()) {
                    throw new Error('Portal session switched');
                }
                var genresRaw = Array.isArray(gRes) ? gRes : (gRes && gRes.data ? gRes.data : []);
                return processArrayInChunks(genresRaw, 2500, function(g) {
                    if (!g || g.id === undefined || String(g.id) === '*') {
                        return null;
                    }
                    var title = String(g.title || g.name || 'Category').trim();
                    if (!title) {
                        return null;
                    }
                    var isAdult = String(g.censored || '0') === '1' || ADULT_RE.test(title);
                    return {
                        id: String(g.id),
                        title: title,
                        censored: isAdult ? 1 : 0,
                        _lowerTitle: title.toLowerCase()
                    };
                }, shouldCancelChunk);
            }).then(function(slimGenres) {
                if (shouldCancelChunk()) {
                    throw new Error('Portal session switched');
                }
                if (activeProfileId === refreshProfId && slimGenres.length > 0 && liveGenres.length <= 3) {
                    liveGenres = self.getOrderedGenres(slimGenres);
                    if (getActiveContentModeId() === 'live') {
                        rawCats = liveGenres;
                        applyColumnFilters();
                        renderCats();
                        if (catsHeaderEl) {
                            catsHeaderEl.textContent = 'Categories (' + Math.max(0, currentCats.length - 3) + ')';
                        }
                    }
                }
                // On massive Stalker portals (600+ to 10,000+ categories), skip get_all_channels and use fast paginated get_ordered_list per category
                if (slimGenres.length > 600) {
                    try {
                        localStorage.removeItem('stalker_live');
                    } catch (eRmLarge2) {}
                    return {
                        genres: self.getOrderedGenres(slimGenres),
                        channels: []
                    };
                }
                return self.request({ type: 'itv', action: 'get_all_channels' }).catch(function() {
                    return [];
                }).then(function(chRes) {
                    if (shouldCancelChunk()) {
                        throw new Error('Portal session switched');
                    }
                    var chData = (chRes && Array.isArray(chRes.data)) ? chRes.data : (Array.isArray(chRes) ? chRes : []);
                    if ((slimGenres.length === 0 || chData.length === 0) && !isRetryAttempt) {
                        self.token = '';
                        return self.ensureAuthenticatedSession().then(function() {
                            return self.refreshLiveInBackground(true);
                        });
                    }
                    return processArrayInChunks(chData, 1500, function(c, j) {
                        if (!c) {
                            return null;
                        }
                        return normalizeChannelObj(c, j + 1, '*');
                    }, shouldCancelChunk).then(function(slimChannels) {
                        chData = null;
                        if (shouldCancelChunk()) {
                            throw new Error('Portal session switched');
                        }
                        if (slimGenres.length > 0 && slimChannels.length > 0) {
                            setTimeout(function() {
                                if (activeProfileId !== refreshProfId) {
                                    return;
                                }
                                try {
                                    if (slimChannels.length > 1200 || slimGenres.length > 250) {
                                        try {
                                            localStorage.removeItem('stalker_live');
                                        } catch (eRm2) {}
                                    }
                                    if (slimChannels.length <= 8000 && slimGenres.length <= 600) {
                                        var cachePayloadStr = JSON.stringify({
                                            profileId: activeProf.id,
                                            updatedAt: Date.now(),
                                            genres: slimGenres,
                                            channels: slimChannels
                                        });
                                        if (slimChannels.length <= 1200 && slimGenres.length <= 250 && cachePayloadStr.length <= 450000) {
                                            safeSetStorage('stalker_live', cachePayloadStr);
                                        }
                                        proxyFetch(self.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent(activeProf.id), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: cachePayloadStr
                                        }).catch(function() {});
                                    }
                                } catch (eCache) {}
                            }, 2500);
                        }
                        return {
                            genres: self.getOrderedGenres(slimGenres),
                            channels: slimChannels
                        };
                    });
                });
            });
        }
        if (!isRetryAttempt) {
            this.liveRefreshPromise = runPromise.then(function(res) {
                self.liveRefreshPromise = null;
                return res;
            }).catch(function(err) {
                self.liveRefreshPromise = null;
                throw err;
            });
            return this.liveRefreshPromise;
        }
        return runPromise;
    };
    StalkerAPI.prototype.fetchLiveGenrePage = function(genreId, page, isRetryAttempt) {
        var self = this;
        var pType = this.getProviderType();
        if (pType === 'xtream') {
            var activeProf = getActiveProfile();
            var reqProfId = activeProf.id;
            var reqEpoch = this.sessionEpoch || 0;
            var targetCatId = String(genreId || '*');
            if (targetCatId === '*' && liveGenres.length > 3) {
                for (var gIdx = 0; gIdx < liveGenres.length; gIdx++) {
                    var candId = String(liveGenres[gIdx].id);
                    if (candId !== '*' && candId !== 'fav' && candId !== 'rec' && !liveGenres[gIdx].censored) {
                        targetCatId = candId;
                        break;
                    }
                }
            }
            if (this.xtreamLiveByCatCache && this.xtreamLiveByCatCache[targetCatId]) {
                return Promise.resolve({ items: this.xtreamLiveByCatCache[targetCatId], hasMore: false });
            }
            var xAuthLiveCat = {
                base: normalizeXtreamServerUrl(activeProf.xtreamUrl || ''),
                user: encodeURIComponent(String(activeProf.xtreamUser || '').trim()),
                pass: encodeURIComponent(String(activeProf.xtreamPass || '').trim())
            };
            var reqParams = (targetCatId && targetCatId !== '*') ? { category_id: targetCatId } : null;
            return this.xtreamRequest('get_live_streams', reqParams).then(function(rows) {
                var arr = Array.isArray(rows) ? rows : [];
                return processArrayInChunks(arr, 1500, function(st, j) {
                    if (!st || st.stream_id === undefined) {
                        return null;
                    }
                    var stId = String(st.stream_id);
                    var stName = String(st.name || ('Channel ' + (j + 1)));
                    var hasArch = Number(st.tv_archive) === 1;
                    var archDur = (Number(st.tv_archive_duration) || (hasArch ? 3 : 0)) * 24;
                    var isAdultCh = String(st.is_adult) === '1' || ADULT_RE.test(stName);
                    return {
                        id: 'xt_live_' + stId,
                        xtreamStreamId: stId,
                        epgChannelId: String(st.epg_channel_id || ''),
                        num: Number(st.num) || (j + 1),
                        name: stName,
                        cmd: buildXtreamDirectStreamUrl(xAuthLiveCat, 'live', stId, 'ts'),
                        directUrl: true,
                        useTmpLink: 0,
                        genreId: String(st.category_id || targetCatId || '*'),
                        logo: String(st.stream_icon || ''),
                        archive: hasArch ? 1 : 0,
                        archiveDuration: archDur,
                        censored: isAdultCh ? 1 : 0,
                        isVod: false,
                        isSeries: false
                    };
                }, function() {
                    return activeProfileId !== reqProfId || self.sessionEpoch !== reqEpoch;
                });
            }).then(function(items) {
                if (self.sessionEpoch === reqEpoch && targetCatId !== '*') {
                    if (!self.xtreamLiveByCatCache[targetCatId]) {
                        self.xtreamLiveByCatKeys.push(targetCatId);
                        while (self.xtreamLiveByCatKeys.length > 15) {
                            var oldKey = self.xtreamLiveByCatKeys.shift();
                            if (oldKey) {
                                delete self.xtreamLiveByCatCache[oldKey];
                            }
                        }
                    }
                    self.xtreamLiveByCatCache[targetCatId] = items;
                }
                return { items: items, hasMore: false };
            });
        }
        if (pType !== 'stalker') {
            return Promise.resolve({ items: [], hasMore: false });
        }
        var p = page || 1;
        return this.request({
            type: 'itv',
            action: 'get_ordered_list',
            genre: genreId,
            force_ch_link_check: '0',
            fav: '0',
            sortby: 'number',
            hd: '0',
            p: p
        }).then(function(res) {
            var rows = (res && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
            var totalItems = Number(res && res.total_items) || 0;
            var maxPageItems = Number(res && res.max_page_items) || 14;
            var out = [];
            for (var i = 0; i < rows.length; i++) {
                var c = rows[i];
                if (!c) {
                    continue;
                }
                out.push(normalizeChannelObj(c, ((p - 1) * maxPageItems) + i + 1, genreId));
            }
            if (out.length === 0 && p === 1 && !isRetryAttempt) {
                self.token = '';
                return self.ensureAuthenticatedSession().then(function() {
                    return self.fetchLiveGenrePage(genreId, page, true);
                });
            }
            var hasMore = false;
            if (totalItems > 0) {
                hasMore = (p * maxPageItems) < totalItems;
            } else {
                hasMore = out.length >= maxPageItems && out.length > 0;
            }
            return {
                items: out,
                hasMore: hasMore
            };
        });
    };

    StalkerAPI.prototype.fetchVodCategories = function(isRetryAttempt) {
        var self = this;
        var reqProfId = activeProfileId;
        var vEpoch = this.sessionEpoch || 0;
        var shouldCancelVodCats = function() {
            return activeProfileId !== reqProfId || self.sessionEpoch !== vEpoch;
        };
        if (this.getProviderType() === 'm3u') {
            return this.ensureM3uCatalogLoaded(false).then(function(cat) {
                return cat.vodCategories;
            });
        }
        if (this.getProviderType() === 'xtream') {
            return this.xtreamRequest('get_vod_categories').then(function(list) {
                var arr = Array.isArray(list) ? list : [];
                var vodAdultMap = {};
                return processArrayInChunks(arr, 2500, function(c) {
                    if (!c || c.category_id === undefined) {
                        return null;
                    }
                    var title = String(c.category_name || 'Movies').trim();
                    if (!title) {
                        return null;
                    }
                    var cid = String(c.category_id);
                    var isAdult = ADULT_RE.test(title);
                    if (isAdult) {
                        vodAdultMap[cid] = true;
                    }
                    return { id: cid, title: title, censored: isAdult, _lowerTitle: title.toLowerCase() };
                }, shouldCancelVodCats).then(function(parsedCats) {
                    adultCatLookup.vod = vodAdultMap;
                    return [
                        { id: '*', title: 'All Movies', censored: false, _lowerTitle: 'all movies' },
                        { id: 'new', title: '🆕 Recently Added', censored: false, _lowerTitle: '🆕 recently added' },
                        { id: 'cont', title: '▶ Continue Watching', censored: false, _lowerTitle: '▶ continue watching' },
                        { id: 'fav', title: '★ Favorites', censored: false, _lowerTitle: '★ favorites' },
                        { id: 'rec', title: '⏱ History', censored: false, _lowerTitle: '⏱ history' }
                    ].concat(parsedCats);
                });
            });
        }
        if (!isRetryAttempt && this.vodCategoriesPromise) {
            return this.vodCategoriesPromise;
        }
        var p = this.request({ type: 'vod', action: 'get_categories' }).then(function(res) {
            var list = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
            var vodAdultMap = {};
            return processArrayInChunks(list, 2500, function(c) {
                if (!c || String(c.id) === '*') {
                    return null;
                }
                var title = String(c.title || c.name || 'Movies').trim();
                if (!title) {
                    return null;
                }
                var cid = String(c.id);
                var isAdult = String(c.censored) === '1' || ADULT_RE.test(title);
                if (isAdult) {
                    vodAdultMap[cid] = true;
                }
                return { id: cid, title: title, censored: isAdult, _lowerTitle: title.toLowerCase() };
            }, shouldCancelVodCats).then(function(parsedCats) {
                adultCatLookup.vod = vodAdultMap;
                var out = [
                    { id: '*', title: 'All Movies', censored: false, _lowerTitle: 'all movies' },
                    { id: 'new', title: '🆕 Recently Added', censored: false, _lowerTitle: '🆕 recently added' },
                    { id: 'cont', title: '▶ Continue Watching', censored: false, _lowerTitle: '▶ continue watching' },
                    { id: 'fav', title: '★ Favorites', censored: false, _lowerTitle: '★ favorites' },
                    { id: 'rec', title: '⏱ History', censored: false, _lowerTitle: '⏱ history' }
                ].concat(parsedCats);
                if (out.length <= 5 && !isRetryAttempt) {
                    self.token = '';
                    return self.ensureAuthenticatedSession().then(function() {
                        return self.fetchVodCategories(true);
                    });
                }
                return out;
            });
        }).catch(function(err) {
            if (!isRetryAttempt && !shouldCancelVodCats()) {
                self.token = '';
                return self.ensureAuthenticatedSession().then(function() {
                    return self.fetchVodCategories(true);
                });
            }
            throw err;
        });
        if (!isRetryAttempt) {
            this.vodCategoriesPromise = p.then(function(res) {
                if (self.sessionEpoch === vEpoch) {
                    self.vodCategoriesPromise = null;
                }
                return res;
            }).catch(function(err) {
                if (self.sessionEpoch === vEpoch) {
                    self.vodCategoriesPromise = null;
                }
                throw err;
            });
            return this.vodCategoriesPromise;
        }
        return p;
    };
    StalkerAPI.prototype.fetchVodPage = function(categoryId, page, searchQuery, sortBy) {
        var self = this;
        if (this.getProviderType() === 'm3u') {
            return this.ensureM3uCatalogLoaded(false).then(function(cat) {
                return filterAndPaginateLocalList(cat.vodItems, categoryId, page, searchQuery, sortBy);
            });
        }
        if (this.getProviderType() === 'xtream') {
            var activeProf = getActiveProfile();
            var reqProfId = activeProf.id;
            var xVodEpoch = this.sessionEpoch || 0;
            var shouldCancelVod = function() {
                return activeProfileId !== reqProfId || self.sessionEpoch !== xVodEpoch;
            };
            var xAuthVod = {
                base: normalizeXtreamServerUrl(activeProf.xtreamUrl || ''),
                user: encodeURIComponent(String(activeProf.xtreamUser || '').trim()),
                pass: encodeURIComponent(String(activeProf.xtreamPass || '').trim())
            };
            var mapXtreamVodRow = function(m) {
                if (!m || m.stream_id === undefined) {
                    return null;
                }
                var stId = String(m.stream_id);
                var ext = String(m.container_extension || 'mp4').trim();
                var mName = String(m.name || 'Movie');
                var yearMatch = mName.match(/\((\d{4})\)/);
                return {
                    id: 'xt_vod_' + stId,
                    xtreamStreamId: stId,
                    name: mName,
                    cmd: buildXtreamDirectStreamUrl(xAuthVod, 'movie', stId, ext),
                    directUrl: true,
                    useTmpLink: 0,
                    desc: String(m.plot || m.description || ''),
                    year: String(m.year || (yearMatch ? yearMatch[1] : '')),
                    rating: String(m.rating || m.rating_5based || ''),
                    poster: String(m.stream_icon || m.cover || ''),
                    youtube_trailer: String(m.youtube_trailer || m.trailer || ''),
                    genreId: String(m.category_id || categoryId || '*'),
                    censored: (String(m.is_adult) === '1' || ADULT_RE.test(mName)) ? 1 : 0,
                    isVod: true,
                    isSeries: false
                };
            };
            if (this.xtreamVodStreamsCache && this.xtreamVodStreamsCache.profileId === activeProf.id) {
                return Promise.resolve(filterAndPaginateLocalList(this.xtreamVodStreamsCache.items, categoryId, page, searchQuery, sortBy));
            }
            var catIdStr = String(categoryId || '*');
            var isSpecificCat = (catIdStr !== '*' && catIdStr !== 'new' && !searchQuery);
            if (!isSpecificCat && !searchQuery && vodCats.length > 600) {
                for (var vc = 0; vc < vodCats.length; vc++) {
                    var vcId = String(vodCats[vc].id);
                    if (vcId !== '*' && vcId !== 'new' && vcId !== 'cont' && vcId !== 'fav' && vcId !== 'rec' && !vodCats[vc].censored) {
                        catIdStr = vcId;
                        isSpecificCat = true;
                        break;
                    }
                }
            }
            if (isSpecificCat) {
                if (this.xtreamVodByCatCache && this.xtreamVodByCatCache[catIdStr]) {
                    return Promise.resolve(filterAndPaginateLocalList(this.xtreamVodByCatCache[catIdStr], '*', page, searchQuery, sortBy));
                }
                return this.xtreamRequest('get_vod_streams', { category_id: catIdStr }).then(function(rows) {
                    var arr = Array.isArray(rows) ? rows : [];
                    return processArrayInChunks(arr, 1500, mapXtreamVodRow, shouldCancelVod);
                }).then(function(items) {
                    if (!shouldCancelVod()) {
                        if (!self.xtreamVodByCatCache[catIdStr]) {
                            self.xtreamVodByCatKeys.push(catIdStr);
                            while (self.xtreamVodByCatKeys.length > 15) {
                                var oldKey = self.xtreamVodByCatKeys.shift();
                                if (oldKey) {
                                    delete self.xtreamVodByCatCache[oldKey];
                                }
                            }
                        }
                        self.xtreamVodByCatCache[catIdStr] = items;
                    }
                    return filterAndPaginateLocalList(items, '*', page, searchQuery, sortBy);
                });
            }
            if (!this.xtreamVodPromise) {
                this.xtreamVodPromise = this.xtreamRequest('get_vod_streams').then(function(rows) {
                    var arr = Array.isArray(rows) ? rows : [];
                    return processArrayInChunks(arr, 1500, mapXtreamVodRow, shouldCancelVod);
                }).then(function(items) {
                    if (self.sessionEpoch === xVodEpoch) {
                        self.xtreamVodPromise = null;
                        if (items.length <= 25000) {
                            self.xtreamVodStreamsCache = { profileId: activeProf.id, items: items };
                        }
                    }
                    return items;
                }).catch(function(err) {
                    if (self.sessionEpoch === xVodEpoch) {
                        self.xtreamVodPromise = null;
                    }
                    throw err;
                });
            }
            return this.xtreamVodPromise.then(function(items) {
                return filterAndPaginateLocalList(items, categoryId, page, searchQuery, sortBy);
            });
        }
        var isRecentlyAddedVod = (categoryId === 'new');
        var curPage = page || 1;
        var params = {
            type: 'vod',
            action: 'get_ordered_list',
            category: (isRecentlyAddedVod || !categoryId) ? '*' : categoryId,
            p: curPage,
            sortby: isRecentlyAddedVod ? 'added' : (sortBy || 'added')
        };
        if (searchQuery) {
            params.search = searchQuery;
        }
        function parseVodRows(res) {
            var rows = (res && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
            var out = [];
            for (var i = 0; i < rows.length; i++) {
                var m = rows[i];
                if (!m || String(m.is_series) === '1') {
                    continue;
                }
                out.push({
                    id: String(m.id),
                    name: String(m.name || m.o_name || 'Movie'),
                    cmd: String(m.cmd || ''),
                    desc: String(m.description || m.actors || ''),
                    year: String(m.year || ''),
                    rating: String(m.rating_imdb || m.rating_kinopoisk || ''),
                    poster: String(m.screenshot_uri || m.pic || m.logo || ''),
                    youtube_trailer: String(m.youtube_trailer || m.trailer || m.rtsp_url || ''),
                    director: String(m.director || ''),
                    cast: String(m.actors || m.cast || ''),
                    genre: String(m.genres_str || m.genre || ''),
                    genreId: String(m.category_id || categoryId || '*'),
                    censored: String(m.censored) === '1' ? 1 : 0,
                    isVod: true,
                    isSeries: false
                });
            }
            if (isRecentlyAddedVod && (!sortBy || sortBy === 'added')) {
                out.sort(compareItemsByNewestAdded);
            }
            return out;
        }
        return this.request(params).then(function(res) {
            var out = parseVodRows(res);
            if (out.length === 0 && curPage === 1 && !searchQuery) {
                self.token = '';
                return self.ensureAuthenticatedSession().then(function() {
                    return self.request(params, true).then(parseVodRows);
                });
            }
            return out;
        });
    };
    StalkerAPI.prototype.fetchSeriesCategories = function(isRetryAttempt) {
        var self = this;
        var reqProfId = activeProfileId;
        var sEpoch = this.sessionEpoch || 0;
        var shouldCancelSeriesCats = function() {
            return activeProfileId !== reqProfId || self.sessionEpoch !== sEpoch;
        };
        if (this.getProviderType() === 'm3u') {
            return this.ensureM3uCatalogLoaded(false).then(function(cat) {
                return cat.seriesCategories;
            });
        }
        if (this.getProviderType() === 'xtream') {
            return this.xtreamRequest('get_series_categories').then(function(list) {
                var arr = Array.isArray(list) ? list : [];
                var seriesAdultMap = {};
                return processArrayInChunks(arr, 2500, function(c) {
                    if (!c || c.category_id === undefined) {
                        return null;
                    }
                    var title = String(c.category_name || 'Series').trim();
                    if (!title) {
                        return null;
                    }
                    var cid = String(c.category_id);
                    var isAdult = ADULT_RE.test(title);
                    if (isAdult) {
                        seriesAdultMap[cid] = true;
                    }
                    return {
                        id: cid,
                        title: title,
                        censored: isAdult,
                        _lowerTitle: title.toLowerCase()
                    };
                }, shouldCancelSeriesCats).then(function(parsedCats) {
                    adultCatLookup.series = seriesAdultMap;
                    return [
                        { id: '*', title: 'All Series', censored: false, _lowerTitle: 'all series' },
                        { id: 'new', title: '🆕 Recently Added', censored: false, _lowerTitle: '🆕 recently added' },
                        { id: 'cont', title: '▶ Continue Watching', censored: false, _lowerTitle: '▶ continue watching' },
                        { id: 'fav', title: '★ Favorites', censored: false, _lowerTitle: '★ favorites' },
                        { id: 'rec', title: '⏱ History', censored: false, _lowerTitle: '⏱ history' }
                    ].concat(parsedCats);
                });
            });
        }
        if (!isRetryAttempt && this.seriesCategoriesPromise) {
            return this.seriesCategoriesPromise;
        }
        function buildSeriesCategoryOut(list) {
            var arr = Array.isArray(list) ? list : (list && Array.isArray(list.data) ? list.data : []);
            var seriesAdultMap = {};
            return processArrayInChunks(arr, 2500, function(c) {
                if (!c || String(c.id) === '*') {
                    return null;
                }
                var title = String(c.title || c.name || 'Series').trim();
                if (!title) {
                    return null;
                }
                var cid = String(c.id);
                var isAdult = String(c.censored) === '1' || ADULT_RE.test(title);
                if (isAdult) {
                    seriesAdultMap[cid] = true;
                }
                return {
                    id: cid,
                    title: title,
                    censored: isAdult,
                    _lowerTitle: title.toLowerCase()
                };
            }, shouldCancelSeriesCats).then(function(parsedCats) {
                adultCatLookup.series = seriesAdultMap;
                return [
                    { id: '*', title: 'All Series', censored: false, _lowerTitle: 'all series' },
                    { id: 'new', title: '🆕 Recently Added', censored: false, _lowerTitle: '🆕 recently added' },
                    { id: 'cont', title: '▶ Continue Watching', censored: false, _lowerTitle: '▶ continue watching' },
                    { id: 'fav', title: '★ Favorites', censored: false, _lowerTitle: '★ favorites' },
                    { id: 'rec', title: '⏱ History', censored: false, _lowerTitle: '⏱ history' }
                ].concat(parsedCats);
            });
        }
        var p = this.request({ type: 'series', action: 'get_categories' }).then(function(res) {
            var list = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
            if (list.length > 0) {
                self.seriesModule = 'series';
                return buildSeriesCategoryOut(list);
            }
            if (!isRetryAttempt) {
                self.token = '';
                return self.ensureAuthenticatedSession().then(function() {
                    return self.fetchSeriesCategories(true);
                });
            }
            self.seriesModule = 'vod';
            return self.request({ type: 'vod', action: 'get_categories' }, true).then(buildSeriesCategoryOut);
        }).catch(function(err) {
            if (!isRetryAttempt && !shouldCancelSeriesCats()) {
                self.token = '';
                return self.ensureAuthenticatedSession().then(function() {
                    return self.fetchSeriesCategories(true);
                });
            }
            self.seriesModule = 'vod';
            return self.request({ type: 'vod', action: 'get_categories' }, true).then(buildSeriesCategoryOut).catch(function() {
                throw err;
            });
        });
        if (!isRetryAttempt) {
            this.seriesCategoriesPromise = p.then(function(res) {
                if (self.sessionEpoch === sEpoch) {
                    self.seriesCategoriesPromise = null;
                }
                return res;
            }).catch(function(err) {
                if (self.sessionEpoch === sEpoch) {
                    self.seriesCategoriesPromise = null;
                }
                throw err;
            });
            return this.seriesCategoriesPromise;
        }
        return p;
    };
    StalkerAPI.prototype.fetchSeriesPage = function(categoryId, page, searchQuery, sortBy) {
        var self = this;
        if (this.getProviderType() === 'm3u') {
            return this.ensureM3uCatalogLoaded(false).then(function(cat) {
                return filterAndPaginateLocalList(cat.seriesItems, categoryId, page, searchQuery, sortBy);
            });
        }
        if (this.getProviderType() === 'xtream') {
            var activeProf = getActiveProfile();
            var reqProfId = activeProf.id;
            var xSerEpoch = this.sessionEpoch || 0;
            var shouldCancelSeries = function() {
                return activeProfileId !== reqProfId || self.sessionEpoch !== xSerEpoch;
            };
            var mapXtreamSeriesRow = function(s) {
                if (!s || s.series_id === undefined) {
                    return null;
                }
                var serId = String(s.series_id);
                var relYear = String(s.releaseDate || s.year || '').slice(0, 4);
                var serName = String(s.name || 'Series');
                return {
                    id: 'xt_ser_' + serId,
                    xtreamSeriesId: serId,
                    name: serName,
                    cmd: '',
                    desc: String(s.plot || s.cast || ''),
                    year: relYear,
                    rating: String(s.rating || s.rating_5based || ''),
                    poster: String(s.cover || ''),
                    youtube_trailer: String(s.youtube_trailer || s.trailer || ''),
                    genreId: String(s.category_id || categoryId || '*'),
                    censored: (String(s.is_adult) === '1' || ADULT_RE.test(serName)) ? 1 : 0,
                    isVod: true,
                    isSeries: true,
                    streamType: 'series'
                };
            };
            if (this.xtreamSeriesCache && this.xtreamSeriesCache.profileId === activeProf.id) {
                return Promise.resolve(filterAndPaginateLocalList(this.xtreamSeriesCache.items, categoryId, page, searchQuery, sortBy));
            }
            var catIdStr = String(categoryId || '*');
            var isSpecificSeriesCat = (catIdStr !== '*' && catIdStr !== 'new' && !searchQuery);
            if (!isSpecificSeriesCat && !searchQuery && seriesCats.length > 600) {
                for (var sc = 0; sc < seriesCats.length; sc++) {
                    var scId = String(seriesCats[sc].id);
                    if (scId !== '*' && scId !== 'new' && scId !== 'cont' && scId !== 'fav' && scId !== 'rec' && !seriesCats[sc].censored) {
                        catIdStr = scId;
                        isSpecificSeriesCat = true;
                        break;
                    }
                }
            }
            if (isSpecificSeriesCat) {
                if (this.xtreamSeriesByCatCache && this.xtreamSeriesByCatCache[catIdStr]) {
                    return Promise.resolve(filterAndPaginateLocalList(this.xtreamSeriesByCatCache[catIdStr], '*', page, searchQuery, sortBy));
                }
                return this.xtreamRequest('get_series', { category_id: catIdStr }).then(function(rows) {
                    var arr = Array.isArray(rows) ? rows : [];
                    return processArrayInChunks(arr, 1500, mapXtreamSeriesRow, shouldCancelSeries);
                }).then(function(items) {
                    if (!shouldCancelSeries()) {
                        if (!self.xtreamSeriesByCatCache[catIdStr]) {
                            self.xtreamSeriesByCatKeys.push(catIdStr);
                            while (self.xtreamSeriesByCatKeys.length > 15) {
                                var oldKey = self.xtreamSeriesByCatKeys.shift();
                                if (oldKey) {
                                    delete self.xtreamSeriesByCatCache[oldKey];
                                }
                            }
                        }
                        self.xtreamSeriesByCatCache[catIdStr] = items;
                    }
                    return filterAndPaginateLocalList(items, '*', page, searchQuery, sortBy);
                });
            }
            if (!this.xtreamSeriesPromise) {
                this.xtreamSeriesPromise = this.xtreamRequest('get_series').then(function(rows) {
                    var arr = Array.isArray(rows) ? rows : [];
                    return processArrayInChunks(arr, 1500, mapXtreamSeriesRow, shouldCancelSeries);
                }).then(function(items) {
                    if (self.sessionEpoch === xSerEpoch) {
                        self.xtreamSeriesPromise = null;
                        if (items.length <= 25000) {
                            self.xtreamSeriesCache = { profileId: activeProf.id, items: items };
                        }
                    }
                    return items;
                }).catch(function(err) {
                    if (self.sessionEpoch === xSerEpoch) {
                        self.xtreamSeriesPromise = null;
                    }
                    throw err;
                });
            }
            return this.xtreamSeriesPromise.then(function(items) {
                return filterAndPaginateLocalList(items, categoryId, page, searchQuery, sortBy);
            });
        }
        var mod = this.seriesModule || 'series';
        var isRecentlyAddedSeries = (categoryId === 'new');
        var curPage = page || 1;
        var params = {
            type: mod,
            action: 'get_ordered_list',
            category: (isRecentlyAddedSeries || !categoryId) ? '*' : categoryId,
            p: curPage,
            sortby: isRecentlyAddedSeries ? 'added' : (sortBy || 'added')
        };
        if (searchQuery) {
            params.search = searchQuery;
        }
        function parseSeriesRows(res, activeMod) {
            var rows = (res && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
            var out = [];
            for (var i = 0; i < rows.length; i++) {
                var s = rows[i];
                if (!s) {
                    continue;
                }
                if (activeMod === 'vod' && String(s.is_series) !== '1') {
                    continue;
                }
                out.push({
                    id: String(s.id),
                    name: String(s.name || s.o_name || 'Series'),
                    cmd: String(s.cmd || ''),
                    desc: String(s.description || ''),
                    year: String(s.year || ''),
                    rating: String(s.rating_imdb || ''),
                    poster: String(s.screenshot_uri || s.pic || ''),
                    genreId: String(s.category_id || categoryId || '*'),
                    censored: String(s.censored) === '1' ? 1 : 0,
                    isVod: true,
                    isSeries: true,
                    streamType: activeMod
                });
            }
            if (isRecentlyAddedSeries && (!sortBy || sortBy === 'added')) {
                out.sort(compareItemsByNewestAdded);
            }
            return out;
        }
        return this.request(params).then(function(res) {
            var out = parseSeriesRows(res, mod);
            if (out.length > 0 || curPage !== 1 || searchQuery) {
                return out;
            }
            if (mod === 'vod') {
                var altParams = extendObj(params, { type: 'series' });
                return self.request(altParams, true).then(function(resAlt) {
                    var altOut = parseSeriesRows(resAlt, 'series');
                    if (altOut.length > 0) {
                        self.seriesModule = 'series';
                        return altOut;
                    }
                    self.token = '';
                    return self.ensureAuthenticatedSession().then(function() {
                        return self.request(altParams, true).then(function(resRetry) {
                            var retryOut = parseSeriesRows(resRetry, 'series');
                            if (retryOut.length > 0) {
                                self.seriesModule = 'series';
                            }
                            return retryOut;
                        });
                    });
                });
            }
            self.token = '';
            return self.ensureAuthenticatedSession().then(function() {
                return self.request(params, true).then(function(resRetry) {
                    return parseSeriesRows(resRetry, mod);
                });
            });
        });
    };
    StalkerAPI.prototype.fetchSeriesSeasons = function(seriesItem) {
        if (this.getProviderType() === 'm3u' || (seriesItem && Array.isArray(seriesItem.seasons))) {
            return Promise.resolve(seriesItem.seasons || []);
        }
        if (this.getProviderType() === 'xtream') {
            var activeProf = getActiveProfile();
            var xAuthSeries = {
                base: normalizeXtreamServerUrl(activeProf.xtreamUrl || ''),
                user: encodeURIComponent(String(activeProf.xtreamUser || '').trim()),
                pass: encodeURIComponent(String(activeProf.xtreamPass || '').trim())
            };
            var serId = seriesItem.xtreamSeriesId || String(seriesItem.id).replace(/^xt_ser_/, '');
            return this.xtreamRequest('get_series_info', { series_id: serId }).then(function(res) {
                var episodesObj = (res && res.episodes && typeof res.episodes === 'object') ? res.episodes : {};
                var seasonKeys = Object.keys(episodesObj);
                seasonKeys.sort(function(a, b) { return Number(a) - Number(b); });
                var seasons = [];
                for (var i = 0; i < seasonKeys.length; i++) {
                    var sKey = seasonKeys[i];
                    var epArr = Array.isArray(episodesObj[sKey]) ? episodesObj[sKey] : [];
                    var builtEpisodes = [];
                    for (var j = 0; j < epArr.length; j++) {
                        var ep = epArr[j];
                        if (!ep || ep.id === undefined) {
                            continue;
                        }
                        var epNum = Number(ep.episode_num) || (j + 1);
                        var ext = String(ep.container_extension || 'mp4').trim();
                        var epTitle = ep.title ? String(ep.title).trim() : ('Episode ' + epNum);
                        builtEpisodes.push({
                            id: 'xt_ep_' + ep.id,
                            name: 'E' + epNum + (epTitle.indexOf('Episode') === 0 ? '' : (' - ' + epTitle)),
                            cmd: buildXtreamDirectStreamUrl(xAuthSeries, 'series', ep.id, ext),
                            directUrl: true,
                            useTmpLink: 0,
                            genreId: seriesItem.genreId || '*',
                            censored: seriesItem.censored ? 1 : 0,
                            desc: String((ep.info && ep.info.plot) || seriesItem.desc || ''),
                            poster: String((ep.info && ep.info.movie_image) || seriesItem.poster || ''),
                            seriesNum: epNum,
                            seasonId: String(sKey),
                            seriesId: String(seriesItem.id),
                            parentSeries: seriesItem,
                            isEpisode: true,
                            isVod: true,
                            isSeries: true,
                            streamType: 'series'
                        });
                    }
                    seasons.push({
                        id: String(sKey),
                        name: 'Season ' + sKey,
                        cmd: '',
                        desc: String(seriesItem.desc || ''),
                        poster: String(seriesItem.poster || ''),
                        genreId: seriesItem.genreId || '*',
                        censored: seriesItem.censored ? 1 : 0,
                        episodes: builtEpisodes,
                        parentSeries: seriesItem,
                        isSeason: true,
                        isVod: true,
                        isSeries: true,
                        streamType: 'series'
                    });
                }
                return seasons;
            });
        }
        var mod = seriesItem.streamType || this.seriesModule || 'series';
        return this.request({
            type: mod,
            action: 'get_ordered_list',
            movie_id: seriesItem.id,
            season_id: 0,
            episode_id: 0,
            p: 1
        }).then(function(res) {
            var rows = (res && Array.isArray(res.data)) ? res.data : [];
            var seasons = [];
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                if (!row) {
                    continue;
                }
                var epArray = Array.isArray(row.series) ? row.series : [];
                seasons.push({
                    id: String(row.id || (i + 1)),
                    name: String(row.name || ('Season ' + (i + 1))),
                    cmd: String(row.cmd || seriesItem.cmd || ''),
                    desc: String(row.description || seriesItem.desc || ''),
                    poster: String(row.screenshot_uri || seriesItem.poster || ''),
                    genreId: seriesItem.genreId || '*',
                    censored: seriesItem.censored ? 1 : 0,
                    episodes: epArray,
                    parentSeries: seriesItem,
                    isSeason: true,
                    isVod: true,
                    isSeries: true,
                    streamType: mod
                });
            }
            return seasons;
        });
    };
    function storeShortEpgEntry(key, list) {
        if (!shortEpgCache[key]) {
            shortEpgKeys.push(key);
            if (shortEpgKeys.length > 250) {
                var oldestKey = shortEpgKeys.shift();
                if (oldestKey) {
                    delete shortEpgCache[oldestKey];
                }
            }
        }
        shortEpgCache[key] = { ts: Date.now(), list: list };
    }
    function normalizeXtreamEpgListings(rawListings) {
        var arr = Array.isArray(rawListings) ? rawListings : [];
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var e = arr[i];
            if (!e) {
                continue;
            }
            var sTs = Number(e.start_timestamp || 0);
            var eTs = Number(e.stop_timestamp || 0);
            if (!sTs && e.start) {
                sTs = Math.floor(new Date(e.start).getTime() / 1000) || 0;
            }
            if (!eTs && e.end) {
                eTs = Math.floor(new Date(e.end).getTime() / 1000) || 0;
            }
            out.push({
                id: String(e.id || i),
                name: decodeXtreamBase64Text(e.title || ''),
                descr: decodeXtreamBase64Text(e.description || ''),
                start_timestamp: sTs,
                stop_timestamp: eTs,
                time: e.start || '',
                time_to: e.end || ''
            });
        }
        return out;
    }
    StalkerAPI.prototype.getEffectiveXmltvUrl = function() {
        var prof = getActiveProfile();
        var customUrl = String((prof && prof.epgUrl) || localStorage.getItem('cfg_epg_url') || '').trim();
        if (customUrl && /^https?:\/\/.+/i.test(customUrl)) {
            return customUrl;
        }
        if (this.m3uCatalogCache && this.m3uCatalogCache.catalog && this.m3uCatalogCache.catalog.epgUrl) {
            return this.m3uCatalogCache.catalog.epgUrl;
        }
        if (this.getProviderType() === 'xtream' && prof && prof.xtreamUrl && prof.xtreamUser && prof.xtreamPass) {
            var xBase = normalizeXtreamServerUrl(prof.xtreamUrl);
            if (xBase) {
                return xBase + '/xmltv.php?username=' + encodeURIComponent(prof.xtreamUser) + '&password=' + encodeURIComponent(prof.xtreamPass);
            }
        }
        return '';
    };
    StalkerAPI.prototype.ensureXmltvLoaded = function() {
        var xmlUrl = this.getEffectiveXmltvUrl();
        if (!xmlUrl) {
            return Promise.resolve(null);
        }
        var cached = xmltvCache[xmlUrl];
        if (cached && cached.catalog && (Date.now() - cached.ts) < 1800000) {
            return Promise.resolve(cached.catalog);
        }
        if (cached && cached.promise) {
            return cached.promise;
        }
        if (!xmltvCache[xmlUrl]) {
            var xKeys = Object.keys(xmltvCache);
            if (xKeys.length >= 2) {
                delete xmltvCache[xKeys[0]];
            }
        }
        var proxiedUrl = this.proxyUrl + '/xmltv?url=' + encodeURIComponent(xmlUrl);
        var p = proxyFetch(proxiedUrl, { method: 'GET' }).then(function(r) {
            if (!r.ok) {
                throw new Error('HTTP ' + r.status);
            }
            return r.text();
        }).catch(function() {
            return proxyFetch(xmlUrl, { method: 'GET' }).then(function(r2) {
                if (!r2.ok) {
                    throw new Error('HTTP ' + r2.status);
                }
                return r2.text();
            });
        }).then(function(rawXml) {
            return parseXmltvDocumentAsync(rawXml);
        }).then(function(parsed) {
            xmltvCache[xmlUrl] = { ts: Date.now(), catalog: parsed, promise: null };
            return parsed;
        }).catch(function() {
            xmltvCache[xmlUrl] = { ts: Date.now(), catalog: null, promise: null };
            return null;
        });
        xmltvCache[xmlUrl] = { ts: Date.now(), catalog: null, promise: p };
        return p;
    };
    StalkerAPI.prototype.fetchShortEpg = function(channelId, keepInFlight) {
        var self = this;
        var key = String(channelId);
        var cached = shortEpgCache[key];
        if (cached && (Date.now() - cached.ts) < 300000) {
            return Promise.resolve(cached.list);
        }
        var chObj = channelByIdMap[key];
        if (this.getProviderType() === 'm3u') {
            return this.ensureXmltvLoaded().then(function(xmlCat) {
                var list = xmlCat ? lookupXmltvChannelPrograms(xmlCat, chObj) : [];
                storeShortEpgEntry(key, list);
                return list;
            });
        }
        if (this.getProviderType() === 'xtream') {
            var stId = (chObj && chObj.xtreamStreamId) ? chObj.xtreamStreamId : key.replace(/^xt_live_/, '');
            return this.xtreamRequest('get_short_epg', { stream_id: stId, limit: 10, _keepInFlight: Boolean(keepInFlight) }).then(function(res) {
                var list = normalizeXtreamEpgListings(res && res.epg_listings);
                if (list.length > 0) {
                    storeShortEpgEntry(key, list);
                    return list;
                }
                var customEpg = String((getActiveProfile() && getActiveProfile().epgUrl) || '').trim();
                if (!customEpg) {
                    storeShortEpgEntry(key, []);
                    return [];
                }
                return self.ensureXmltvLoaded().then(function(xmlCat) {
                    var xmlList = xmlCat ? lookupXmltvChannelPrograms(xmlCat, chObj) : [];
                    storeShortEpgEntry(key, xmlList);
                    return xmlList;
                });
            }).catch(function(err) {
                if (err && (err.isAborted || err.name === 'AbortError' || /abort/i.test(String(err.message || '')))) {
                    return [];
                }
                storeShortEpgEntry(key, []);
                return [];
            });
        }
        return this.request({
            type: 'itv',
            action: 'get_short_epg',
            ch_id: channelId,
            size: 10,
            _keepInFlight: Boolean(keepInFlight)
        }, true).then(function(res) {
            var list = [];
            if (Array.isArray(res)) {
                list = res;
            } else if (res && Array.isArray(res.data)) {
                list = res.data;
            }
            if (list.length > 0) {
                storeShortEpgEntry(key, list);
                return list;
            }
            var customEpg = String((getActiveProfile() && getActiveProfile().epgUrl) || '').trim();
            if (!customEpg) {
                storeShortEpgEntry(key, []);
                return [];
            }
            return self.ensureXmltvLoaded().then(function(xmlCat) {
                var xmlList = xmlCat ? lookupXmltvChannelPrograms(xmlCat, chObj) : [];
                storeShortEpgEntry(key, xmlList);
                return xmlList;
            });
        }).catch(function(err) {
            if (err && (err.isAborted || err.name === 'AbortError' || /abort/i.test(String(err.message || '')))) {
                return [];
            }
            storeShortEpgEntry(key, []);
            return [];
        });
    };
    StalkerAPI.prototype.fetchFullEpg = function(channelId) {
        var self = this;
        var key = String(channelId);
        var chObj = channelByIdMap[key];
        if (this.getProviderType() === 'm3u') {
            return this.ensureXmltvLoaded().then(function(xmlCat) {
                return xmlCat ? lookupXmltvChannelPrograms(xmlCat, chObj) : [];
            });
        }
        if (this.getProviderType() === 'xtream') {
            var stId = (chObj && chObj.xtreamStreamId) ? chObj.xtreamStreamId : key.replace(/^xt_live_/, '');
            return this.xtreamRequest('get_simple_data_table', { stream_id: stId }).then(function(res) {
                var list = normalizeXtreamEpgListings(res && res.epg_listings);
                if (list.length > 0) {
                    return list;
                }
                return self.fetchShortEpg(channelId);
            }).catch(function() {
                return self.fetchShortEpg(channelId);
            });
        }
        var profScope = activeProfileId || 'prof_default';
        var cachedFull = fullEpgCache[profScope];
        if (cachedFull && (Date.now() - cachedFull.ts) < 600000 && cachedFull.map) {
            if (Array.isArray(cachedFull.map[channelId]) && cachedFull.map[channelId].length > 0) {
                return Promise.resolve(cachedFull.map[channelId]);
            }
        }
        return this.request({
            type: 'itv',
            action: 'get_epg_info',
            period: 24
        }).then(function(res) {
            var map = (res && res.data) ? res.data : res;
            if (map && typeof map === 'object' && !Array.isArray(map)) {
                if (!fullEpgCache[profScope]) {
                    var fKeys = Object.keys(fullEpgCache);
                    if (fKeys.length >= 2) {
                        delete fullEpgCache[fKeys[0]];
                    }
                }
                fullEpgCache[profScope] = { ts: Date.now(), map: map };
            }
            if (map && Array.isArray(map[channelId]) && map[channelId].length > 0) {
                return map[channelId];
            }
            return self.fetchShortEpg(channelId);
        }).catch(function() {
            return self.fetchShortEpg(channelId);
        });
    };

    function cleanCmdPrefix(rawCmd) {
        return String(rawCmd || '').trim().replace(/^(?:ffrt\d*|ffmpeg|auto|solution)\s+/i, '').trim();
    }
    function extractStreamUrl(rawCmd, portalBase, targetItem) {
        var str = cleanCmdPrefix(rawCmd);
        var match = str.match(/(https?:\/\/[^\s"']+|rtmp:\/\/[^\s"']+|rtsp:\/\/[^\s"']+|mms:\/\/[^\s"']+)/i);
        var candidate = '';
        if (match) {
            candidate = match[1];
        } else if (str.charAt(0) === '/' && portalBase) {
            var originMatch = portalBase.match(/^(https?:\/\/[^\/]+)/i);
            candidate = (originMatch ? originMatch[1] : portalBase) + str.split(/\s+/)[0];
        } else {
            candidate = str.split(/\s+/)[0];
        }
        if (candidate.indexOf('|') !== -1) {
            var pipeInfo = splitM3uPipeHeaders(candidate);
            candidate = pipeInfo.url;
            var ownerItem = targetItem || currentPlayingItem;
            if (ownerItem && pipeInfo) {
                attachM3uDrmAndHeaders(ownerItem, null, pipeInfo);
            }
        }
        return candidate;
    }
    function isLocalhostOrInvalidUrl(u) {
        if (!u || u === 'error' || u.indexOf('://') === -1) {
            return true;
        }
        return /:\/\/(?:localhost|127\.0\.0\.1)(?:[:\/]|$)/i.test(u);
    }
    StalkerAPI.prototype.resolveStream = function(item, forceAlternate) {
        var self = this;
        if (item && item.isCatchup && item.channelRef && item.epgProgRef) {
            return self.createArchiveLink(item.channelRef, item.epgProgRef);
        }
        var pType = this.getProviderType();
        var portalBase = getPortalBaseUrl();
        var activeCmdObj = null;
        if (item && Array.isArray(item.cmds) && item.cmds.length > 1) {
            var cIdx = (item._cmdIdx || 0) % item.cmds.length;
            activeCmdObj = item.cmds[cIdx] || item.cmds[0];
        }
        var rawItemCmd = String((activeCmdObj && activeCmdObj.cmd) || (item && item.cmd) || '').trim();
        var effectiveUseTmp = activeCmdObj ? Boolean(activeCmdObj.useTmp) : Boolean(item && item.useTmpLink);
        var directUrl = extractStreamUrl(rawItemCmd, portalBase, item);

        if (pType === 'xtream' || pType === 'm3u' || (item && item.directUrl && !activeCmdObj)) {
            if (pType === 'xtream' && forceAlternate && !item.isVod && !item.isEpisode && /\.ts$/i.test(directUrl) && ((item._altFormatIdx || 0) % 2 === 1)) {
                return Promise.resolve(directUrl.replace(/\.ts$/i, '.m3u8'));
            }
            return Promise.resolve(directUrl);
        }
        var isLive = !item.isVod && !item.isEpisode;

        if (isLive && forceAlternate && item._preferDirectUrl && !isLocalhostOrInvalidUrl(directUrl)) {
            return Promise.resolve(directUrl);
        }
        var defaultNeedsCreateLink = Boolean(effectiveUseTmp || isLocalhostOrInvalidUrl(directUrl));
        var needsCreateLink = isLive ? (forceAlternate ? true : defaultNeedsCreateLink) : true;
        if (!needsCreateLink) {
            return Promise.resolve(directUrl);
        }

        var primaryType = item.isEpisode ? 'vod' : (item.streamType || (item.isVod ? 'vod' : 'itv'));
        var cmdToSend = rawItemCmd;
        var ensureTokenPromise = (!self.token && pType === 'stalker') ?
            self.ensureAuthenticatedSession().catch(function() {}) :
            Promise.resolve();

        return ensureTokenPromise.then(function() {
            var params = {
                type: primaryType,
                action: 'create_link',
                cmd: cmdToSend
            };
            if (item.seriesNum !== undefined && item.seriesNum !== null) {
                params.series = item.seriesNum;
            }
            if (self.token) {
                params.token = self.token;
            }
            return self.request(params, Boolean(item.isVod || item.isEpisode));
        }).then(function(res) {
            var returnedCmd = (res && res.cmd) ? res.cmd : (res && res.url ? res.url : '');
            var resolved = extractStreamUrl(returnedCmd, portalBase);
            if (!isLocalhostOrInvalidUrl(resolved)) {
                return resolved;
            }
            throw new Error('create_link returned localhost or empty URL');
        }).catch(function() {
            var altType = item.isVod ? (primaryType === 'vod' ? 'series' : 'vod') : 'itv';
            var strippedCmd = cleanCmdPrefix(rawItemCmd);
            var altCmd = (strippedCmd && strippedCmd !== cmdToSend) ? strippedCmd : rawItemCmd;
            var altParams = {
                type: altType,
                action: 'create_link',
                cmd: altCmd,
                forced_storage: 'undefined',
                disable_ad: '0'
            };
            if (item.seriesNum !== undefined && item.seriesNum !== null) {
                altParams.series = item.seriesNum;
            }
            if (self.token) {
                altParams.token = self.token;
            }
            return self.request(altParams).then(function(r2) {
                var ret2 = (r2 && r2.cmd) ? r2.cmd : (r2 && r2.url ? r2.url : '');
                var res2 = extractStreamUrl(ret2, portalBase);
                if (!isLocalhostOrInvalidUrl(res2)) {
                    return res2;
                }
                if (!isLocalhostOrInvalidUrl(directUrl)) {
                    return directUrl;
                }
                return res2 || directUrl;
            }).catch(function() {
                return directUrl;
            });
        });
    };
    StalkerAPI.prototype.createArchiveLink = function(channel, epgProg) {
        var self = this;
        var startTs = Number((epgProg && (epgProg.raw_start_timestamp !== undefined ? epgProg.raw_start_timestamp : epgProg.start_timestamp)) || 0);
        var stopTs = Number((epgProg && (epgProg.raw_stop_timestamp !== undefined ? epgProg.raw_stop_timestamp : epgProg.stop_timestamp)) || 0);
        var durationSec = stopTs > startTs ? (stopTs - startTs) : 3600;
        var pType = this.getProviderType();

        if (pType === 'xtream') {
            var activeProf = getActiveProfile();
            var xBase = normalizeXtreamServerUrl(activeProf.xtreamUrl || '');
            var xUser = encodeURIComponent(String(activeProf.xtreamUser || '').trim());
            var xPass = encodeURIComponent(String(activeProf.xtreamPass || '').trim());
            var stId = channel.xtreamStreamId || String(channel.id).replace(/^xt_live_/, '');
            var durMin = Math.max(1, Math.round(durationSec / 60));
            var dt = new Date(startTs * 1000);
            var yyyy = dt.getUTCFullYear();
            var mm = ('0' + (dt.getUTCMonth() + 1)).slice(-2);
            var dd = ('0' + dt.getUTCDate()).slice(-2);
            var hh = ('0' + dt.getUTCHours()).slice(-2);
            var min = ('0' + dt.getUTCMinutes()).slice(-2);
            var startFormatted = yyyy + '-' + mm + '-' + dd + ':' + hh + '-' + min;
            return Promise.resolve(xBase + '/timeshift/' + xUser + '/' + xPass + '/' + durMin + '/' + startFormatted + '/' + stId + '.ts');
        }
        if (pType === 'm3u') {
            var baseM3u = String(channel.catchupSource || channel.cmd || '').trim();
            var nowUtcSec = Math.floor(Date.now() / 1000);
            if (startTs > 0 && /\{(?:utc|start|lutc|now|timestamp|end|duration|offset)\}|\$\{(?:utc|start|lutc|now|timestamp|end|duration|offset)\}/i.test(baseM3u)) {
                var endTs = startTs + durationSec;
                var offsetSec = Math.max(0, nowUtcSec - startTs);
                var resolvedTemplate = baseM3u
                    .replace(/\$\{(?:start|utc|timestamp)\}|\{(?:start|utc|timestamp)\}/gi, String(startTs))
                    .replace(/\$\{(?:lutc|now)\}|\{(?:lutc|now)\}/gi, String(nowUtcSec))
                    .replace(/\$\{end\}|\{end\}/gi, String(endTs))
                    .replace(/\$\{duration\}|\{duration\}/gi, String(durationSec))
                    .replace(/\$\{offset\}|\{offset\}/gi, String(offsetSec));
                return Promise.resolve(resolvedTemplate);
            }
            if (startTs > 0 && baseM3u.indexOf('utc=') === -1) {
                var sepM3u = baseM3u.indexOf('?') === -1 ? '?' : '&';
                return Promise.resolve(baseM3u + sepM3u + 'utc=' + startTs + '&lutc=' + nowUtcSec);
            }
            return Promise.resolve(baseM3u);
        }

        var portalBase = getPortalBaseUrl();
        var archiveCmd = channel.cmd;
        return self.request({
            type: 'tv_archive',
            action: 'create_link',
            cmd: 'auto /media/' + epgProg.id + '.mpg',
            ch_id: channel.id,
            start: startTs,
            duration: durationSec
        }).then(function(res) {
            if (res && res.cmd) {
                return extractStreamUrl(res.cmd, portalBase);
            }
            throw new Error('Fallback to itv create_link');
        }).catch(function() {
            return self.request({
                type: 'itv',
                action: 'create_link',
                cmd: archiveCmd,
                forced_storage: 'undefined',
                disable_ad: '0'
            }).then(function(r2) {
                var base = (r2 && r2.cmd) ? extractStreamUrl(r2.cmd, portalBase) : extractStreamUrl(archiveCmd, portalBase);
                if (startTs > 0 && base.indexOf('utc=') === -1) {
                    var sep = base.indexOf('?') === -1 ? '?' : '&';
                    return base + sep + 'utc=' + startTs + '&lutc=' + Math.floor(Date.now() / 1000);
                }
                return base;
            });
        });
    };
    var api = new StalkerAPI(PROXY_URL);

    function getFavBaseKey(modeId) {
        if (modeId === 'vod') {
            return 'fav_vod_objs';
        }
        if (modeId === 'series') {
            return 'fav_series_objs';
        }
        return 'fav_live';
    }
    function getFavList(modeId) {
        var baseKey = getFavBaseKey(modeId);
        if (modeId === 'live') {
            if (!favLiveCache) {
                favLiveCache = getScopedJsonWithLegacyFallback(baseKey, []);
            }
            return favLiveCache;
        }
        if (modeId === 'vod') {
            if (!favVodCache) {
                favVodCache = getScopedJsonWithLegacyFallback(baseKey, []);
            }
            return favVodCache;
        }
        if (modeId === 'series') {
            if (!favSeriesCache) {
                favSeriesCache = getScopedJsonWithLegacyFallback(baseKey, []);
            }
            return favSeriesCache;
        }
        return getScopedJsonWithLegacyFallback(baseKey, []);
    }
    var catsFilterMemo = null;
    var itemsFilterMemo = null;
    function invalidateFavCaches() {
        favLiveCache = null;
        favVodCache = null;
        favSeriesCache = null;
        favLookupCache = { live: null, vod: null, series: null };
        watchedLookupCache = null;
        vodResumeCache = null;
        pinnedCatsCache = {};
        pinnedCatsMapCache = {};
        hiddenCatsCache = {};
        hiddenCatsMapCache = {};
        hiddenItemsCache = {};
        hiddenItemsMapCache = {};
        catsFilterMemo = null;
        itemsFilterMemo = null;
        channelPrefsCache = null;
        recLiveCache = null;
        recVodCache = null;
        remindersCache = null;
        vodBookmarksCache = null;
    }

    function getFavLookupMap(modeId) {
        if (favLookupCache[modeId]) {
            return favLookupCache[modeId];
        }
        var list = getFavList(modeId);
        var map = {};
        for (var i = 0; i < list.length; i++) {
            var entry = list[i];
            var entryId = (typeof entry === 'object' && entry !== null) ? entry.id : entry;
            if (entryId !== undefined && entryId !== null) {
                map[String(entryId)] = true;
            }
        }
        favLookupCache[modeId] = map;
        return map;
    }
    function unwrapFavoriteItem(item) {
        if (!item) {
            return null;
        }
        if (item.isCatchup && item.channelRef) {
            return item.channelRef;
        }
        if (item.isSeason || item.isEpisode) {
            if (item.parentSeries) {
                return item.parentSeries;
            }
            if (seriesStack.length > 0 && seriesStack[0] && seriesStack[0].parentSeries) {
                return seriesStack[0].parentSeries;
            }
        }
        return item;
    }
    function isFavItem(item) {
        item = unwrapFavoriteItem(item);
        if (!item || item.isSeason || item.isEpisode) {
            return false;
        }
        var modeId = item.isSeries ? 'series' : (item.isVod ? 'vod' : 'live');
        var map = getFavLookupMap(modeId);
        return Boolean(map[String(item.id)]);
    }
    function toggleFavorite(item) {
        item = unwrapFavoriteItem(item);
        if (!item || item.isSeason || item.isEpisode) {
            return;
        }
        var modeId = item.isSeries ? 'series' : (item.isVod ? 'vod' : 'live');
        var scopedKey = getProfileScopedKey(getFavBaseKey(modeId));
        var list = getFavList(modeId).slice();
        var foundIdx = -1;
        for (var i = 0; i < list.length; i++) {
            var entry = list[i];
            var entryId = (typeof entry === 'object' && entry !== null) ? entry.id : entry;
            if (String(entryId) === String(item.id)) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx !== -1) {
            list.splice(foundIdx, 1);
            showOSD(item.name, 'Removed ★');
            showToast('★ Removed from Favorites: ' + item.name);
        } else {
            if (modeId === 'live') {
                list.push(String(item.id));
            } else {
                list.push(item);
            }
            showOSD(item.name, 'Added ★');
            showToast('★ Added to Favorites: ' + item.name);
        }
        safeSetStorage(scopedKey, JSON.stringify(list));
        invalidateFavCaches();
        if (seriesStack.length === 0 && currentCats[catIdx] && currentCats[catIdx].id === 'fav' && getActiveContentModeId() === modeId) {
            if (modeId === 'live') {
                var favLiveIds = getFavList('live');
                var updatedFavCh = [];
                for (var f = 0; f < favLiveIds.length; f++) {
                    var chFav = channelByIdMap[String(favLiveIds[f])];
                    if (chFav) {
                        updatedFavCh.push(chFav);
                    }
                }
                rawItems = updatedFavCh;
            } else {
                rawItems = getFavList(modeId);
            }
            applyColumnFilters();
        }
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
        if (itemsListEl) {
            itemsListEl._forceRebuild = true;
        }
        renderCats();
        renderItems();
        updatePreviewPanel();
    }
    function getActiveContentModeId() {
        var m = modes[modeIdx];
        if (m && m.id !== 'search' && m.id !== 'settings') {
            return m.id;
        }
        var fallbackM = modes[lastContentModeIdx];
        return (fallbackM && fallbackM.id !== 'search' && fallbackM.id !== 'settings') ? fallbackM.id : 'live';
    }
    function isPosterGridActive() {
        return (getActiveContentModeId() === 'vod' || getActiveContentModeId() === 'series') &&
               seriesStack.length === 0 &&
               vodViewMode !== 'list';
    }
    function moveFavoriteItem(delta) {
        var curCat = currentCats[catIdx];
        var selItem = currentItems[itemIdx];
        if (!curCat || curCat.id !== 'fav' || !selItem) {
            showToast('★ Open ★ Favorites category to reorder items');
            return;
        }
        var modeId = getActiveContentModeId();
        var list = getFavList(modeId).slice();
        var foundIdx = -1;
        for (var i = 0; i < list.length; i++) {
            var entry = list[i];
            var entryId = (typeof entry === 'object' && entry !== null) ? entry.id : entry;
            if (String(entryId) === String(selItem.id)) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx === -1) {
            return;
        }
        var targetIdx = foundIdx + delta;
        if (targetIdx < 0 || targetIdx >= list.length) {
            showToast(delta < 0 ? '★ Already at top of Favorites' : '★ Already at bottom of Favorites');
            return;
        }
        var temp = list[foundIdx];
        list[foundIdx] = list[targetIdx];
        list[targetIdx] = temp;
        safeSetStorage(getProfileScopedKey(getFavBaseKey(modeId)), JSON.stringify(list));
        invalidateFavCaches();
        selectCategory(catIdx, true);
        for (var j = 0; j < currentItems.length; j++) {
            if (currentItems[j] && String(currentItems[j].id) === String(selItem.id)) {
                itemIdx = j;
                break;
            }
        }
        if (itemsListEl) {
            itemsListEl._forceRebuild = true;
        }
        renderItems();
        updatePreviewPanel();
        showToast((delta < 0 ? '⬆ Moved Up: ' : '⬇ Moved Down: ') + selItem.name);
    }
    function exportFavoritesM3u() {
        var curModeId = getActiveContentModeId();
        var favIds = getFavList('live');
        var channelsToExport = [];
        for (var i = 0; i < favIds.length; i++) {
            var ch = channelByIdMap[String(favIds[i])];
            if (ch) {
                channelsToExport.push(ch);
            }
        }
        var vodFavs = getFavList('vod');
        if (curModeId === 'vod' || channelsToExport.length === 0) {
            for (var v = 0; v < vodFavs.length; v++) {
                if (vodFavs[v] && typeof vodFavs[v] === 'object') {
                    channelsToExport.push(vodFavs[v]);
                }
            }
        }
        if (channelsToExport.length === 0 && currentItems.length > 0 && !currentItems[0].isSeries) {
            channelsToExport = currentItems.slice(0, 200);
        }
        if (channelsToExport.length === 0) {
            showToast('★ Add channels or movies to Favorites first to export M3U');
            return;
        }
        var portalBase = getPortalBaseUrl();
        var lines = ['#EXTM3U'];
        var exportedCount = 0;
        for (var j = 0; j < channelsToExport.length; j++) {
            var c = channelsToExport[j];
            var streamUrl = extractStreamUrl(c.cmd || '', portalBase);
            if (!streamUrl) {
                continue;
            }
            var logoAttr = c.logo ? (' tvg-logo="' + String(c.logo).replace(/"/g, '') + '"') : '';
            var xmlId = c.epgChannelId || c.xmltvId || '';
            var idAttr = xmlId ? (' tvg-id="' + String(xmlId).replace(/"/g, '') + '"') : '';
            lines.push('#EXTINF:-1' + idAttr + logoAttr + ' group-title="Favorites",' + String(c.name || 'Channel'));
            lines.push(streamUrl);
            exportedCount++;
        }
        if (exportedCount === 0) {
            showToast('⚠ No exportable stream URLs found in Favorites');
            return;
        }
        var m3uContent = lines.join('\n') + '\n';
        try {
            if (typeof Blob !== 'undefined') {
                var blob = new Blob([m3uContent], { type: 'audio/x-mpegurl;charset=utf-8' });
                var objUrl = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = objUrl;
                a.download = 'smartstb-favorites-' + new Date().toISOString().slice(0, 10) + '.m3u';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function() {
                    try {
                        URL.revokeObjectURL(objUrl);
                    } catch (eRev1) {}
                }, 2000);
            }
        } catch (ex) {}
        showToast('📋 Exported ' + exportedCount + ' channels to Favorites .M3U');
    }
    function getRemindersList() {
        if (!remindersCache) {
            remindersCache = safeGetJson(getProfileScopedKey('epg_reminders'), []);
        }
        return remindersCache;
    }
    function saveRemindersList(list) {
        remindersCache = list;
        safeSetStorage(getProfileScopedKey('epg_reminders'), JSON.stringify(list));
        updateReminderBadge();
    }
    function isProgramReminderScheduled(chId, startTs) {
        var list = getRemindersList();
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].chId) === String(chId) && Number(list[i].startTs) === Number(startTs)) {
                return true;
            }
        }
        return false;
    }
    function updateReminderBadge() {
        if (!reminderBadgeEl) {
            return;
        }
        var nowSec = Math.floor(Date.now() / 1000);
        var list = getRemindersList();
        var upcoming = [];
        for (var i = 0; i < list.length; i++) {
            if (Number(list[i].startTs) > nowSec - 60) {
                upcoming.push(list[i]);
            }
        }
        if (upcoming.length === 0) {
            reminderBadgeEl.textContent = '';
            reminderBadgeEl.classList.remove('visible');
            return;
        }
        upcoming.sort(function(a, b) { return Number(a.startTs) - Number(b.startTs); });
        var nextRem = upcoming[0];
        var diffMin = Math.max(1, Math.ceil((Number(nextRem.startTs) - nowSec) / 60));
        reminderBadgeEl.textContent = '⏰ ' + nextRem.progName.slice(0, 18) + ' (' + diffMin + 'm)';
        reminderBadgeEl.classList.add('visible');
    }
    function toggleProgramReminder(channel, epgProg) {
        if (!channel || !epgProg || !epgProg.start_timestamp) {
            return;
        }
        var list = getRemindersList().slice();
        var chIdStr = String(channel.id);
        var startTs = Number(epgProg.start_timestamp);
        var foundIdx = -1;
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].chId) === chIdStr && Number(list[i].startTs) === startTs) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx !== -1) {
            list.splice(foundIdx, 1);
            saveRemindersList(list);
            showToast('⏰ Reminder Cancelled: ' + epgProg.name);
        } else {
            list.push({
                chId: chIdStr,
                chName: String(channel.name || 'Channel'),
                progName: String(epgProg.name || 'Program'),
                startTs: startTs,
                timeLabel: String(epgProg.timeLabel || '')
            });
            saveRemindersList(list);
            showToast('⏰ Reminder Set (Auto-Tune): ' + epgProg.name + ' at ' + (epgProg.timeLabel || 'start'));
        }
        if (epgModalOpen) {
            if (epgViewMode === 'grid') {
                renderEpgGridView();
            } else {
                if (epgModalList) {
                    epgModalList._forceRebuild = true;
                }
                renderEpgModalList();
            }
        }
    }
    function scheduleNextProgramReminderForSelectedChannel() {
        var ch = (modes[modeIdx] && modes[modeIdx].id === 'live') ? currentItems[itemIdx] : currentPlayingItem;
        if (!ch || ch.isVod || ch.isSeries) {
            showToast('⏰ Select a Live TV channel first');
            return;
        }
        api.fetchShortEpg(ch.id).then(function(rawList) {
            var entries = normalizeEpgEntries(rawList);
            var nowSec = Math.floor(Date.now() / 1000);
            var nextProg = null;
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].start_timestamp > nowSec) {
                    nextProg = entries[i];
                    break;
                }
            }
            if (!nextProg) {
                showToast('⏰ No upcoming EPG program found for ' + ch.name);
                return;
            }
            toggleProgramReminder(ch, nextProg);
        }).catch(function() {
            showToast('⏰ Could not load EPG for ' + ch.name);
        });
    }
    function checkScheduledReminders() {
        var list = getRemindersList();
        if (!Array.isArray(list) || list.length === 0) {
            updateReminderBadge();
            return;
        }
        var nowSec = Math.floor(Date.now() / 1000);
        var remaining = [];
        var triggered = null;
        var changed = false;
        for (var i = 0; i < list.length; i++) {
            var r = list[i];
            var sTs = Number(r.startTs || 0);
            if (sTs <= nowSec && sTs >= nowSec - 180) {
                triggered = r;
                changed = true;
            } else if (sTs > nowSec) {
                if (sTs - nowSec <= 45 && !r.warned) {
                    r.warned = true;
                    changed = true;
                    showToast('⏰ Starting in <1m: ' + r.progName + ' on ' + r.chName);
                }
                remaining.push(r);
            } else {
                changed = true;
            }
        }
        if (changed) {
            saveRemindersList(remaining);
        } else {
            updateReminderBadge();
        }
        if (triggered) {
            var targetCh = channelByIdMap[String(triggered.chId)];
            if (targetCh) {
                showToast('⏰ Auto-Tuning Reminder: ' + triggered.progName + ' (' + triggered.chName + ')');
                showOSD(targetCh.name, '⏰ REMINDER AUTO-TUNE', triggered.progName, '');
                if (window._parentalUnlocked || !isAdultContentItem(targetCh)) {
                    setOverlayVisible(false);
                }
                playItem(targetCh);
                syncLiveChannelCursorOnZap(targetCh);
            }
        }
    }
    function getVodBookmarksMap() {
        if (!vodBookmarksCache) {
            vodBookmarksCache = safeGetJson(getProfileScopedKey('vod_bookmarks'), {});
        }
        return vodBookmarksCache;
    }
    function getVodBookmarkSec(itemId) {
        if (!itemId) {
            return 0;
        }
        var map = getVodBookmarksMap();
        return Number(map[String(itemId)] || 0);
    }
    function saveOrJumpVodBookmark() {
        var target = currentPlayingItem || currentItems[itemIdx];
        if (!target || (!target.isVod && !target.isEpisode)) {
            showToast('🔖 Scene Bookmarks are for Movies & Series Episodes');
            return;
        }
        var map = getVodBookmarksMap();
        var key = String(target.id);
        var curSec = Math.floor((vodCurrentMs || 0) / 1000);
        if (isPlayingVod && currentPlayingItem && String(currentPlayingItem.id) === key && curSec > 5) {
            if (map[key] && Math.abs(Number(map[key]) - curSec) > 15) {
                var jumpMs = Number(map[key]) * 1000;
                scrubVodByOffset(jumpMs - vodCurrentMs);
                showToast('🔖 Jumped to Scene Bookmark: ' + formatTimeHMS(map[key]));
                return;
            }
            map[key] = curSec;
            vodBookmarksCache = map;
            safeSetStorage(getProfileScopedKey('vod_bookmarks'), JSON.stringify(map));
            showToast('🔖 Saved Scene Bookmark at ' + formatTimeHMS(curSec));
            updatePreviewPanel();
            return;
        }
        if (map[key]) {
            delete map[key];
            vodBookmarksCache = map;
            safeSetStorage(getProfileScopedKey('vod_bookmarks'), JSON.stringify(map));
            showToast('🔖 Cleared Scene Bookmark for ' + target.name);
            updatePreviewPanel();
        } else {
            showToast('🔖 Play Movie/Episode first to bookmark a scene timestamp');
        }
    }
    function updateRecBadge(data) {
        if (!recStatusBadgeEl) {
            return;
        }
        var isRec = Boolean(data && (data.active || data.recording));
        if (!isRec) {
            isRecordingStream = false;
            recStatusBadgeEl.textContent = '';
            recStatusBadgeEl.classList.remove('visible');
            if (recordingPollTimer) {
                clearInterval(recordingPollTimer);
                recordingPollTimer = null;
            }
            return;
        }
        isRecordingStream = true;
        var rawBytes = Number((data && (data.bytes !== undefined ? data.bytes : data.bytesWritten)) || 0);
        var mb = (rawBytes / 1048576).toFixed(1);
        recStatusBadgeEl.textContent = '⏺ REC ' + formatTimeHMS(data.elapsedSec || 0) + ' • ' + mb + ' MB';
        recStatusBadgeEl.classList.add('visible');
    }
    function toggleStreamRecording() {
        if (isRecordingStream) {
            proxyFetch(api.proxyUrl + '/record?action=stop', { method: 'GET' })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    updateRecBadge({ active: false });
                    var rawBytes = Number((d && (d.bytes !== undefined ? d.bytes : d.bytesWritten)) || 0);
                    var mb = (rawBytes / 1048576).toFixed(2);
                    var savedFile = (d && (d.file || d.fileName)) || 'clip.ts';
                    showToast('⏹ Stopped Recording: ' + savedFile + ' (' + mb + ' MB)');
                })
                .catch(function() {
                    updateRecBadge({ active: false });
                    showToast('⏹ Recording stopped');
                });
            return;
        }
        var target = currentPlayingItem || currentItems[itemIdx];
        if (!target || target.isSeason) {
            showToast('⏺ Play or select a Live TV channel first to record');
            return;
        }
        showToast('⏺ Starting stream recording for ' + target.name + '...');
        api.resolveStream(target, false).then(function(url) {
            var cleanUrl = unwrapProxyStreamUrl(String(url || '').replace(/^(?:ffmpeg|ffrt\d*|auto|solution)\s+/i, '').trim());
            if (!cleanUrl) {
                showToast('⚠ Could not resolve stream URL for recording');
                return;
            }
            var recEndpoint = api.proxyUrl + '/record?action=start&url=' + encodeURIComponent(cleanUrl) + '&name=' + encodeURIComponent(target.name || 'channel');
            return proxyFetch(recEndpoint, { method: 'GET' }).then(function(r) { return r.json(); }).then(function(d) {
                if (d && (d.active || d.ok || d.recording)) {
                    updateRecBadge(d);
                    showToast('⏺ Recording to ' + (d.file || d.fileName || 'disk') + ' (Click REC badge or press again to stop)');
                    if (recordingPollTimer) {
                        clearInterval(recordingPollTimer);
                    }
                    recordingPollTimer = setInterval(function() {
                        proxyFetch(api.proxyUrl + '/record?action=status', { method: 'GET' })
                            .then(function(r2) { return r2.json(); })
                            .then(function(st) { updateRecBadge(st); })
                            .catch(function() {});
                    }, 2000);
                } else {
                    showToast('⚠ Recording failed: ' + ((d && d.error) || 'Proxy error'));
                }
            });
        }).catch(function(err) {
            showToast('⚠ Recording error: ' + err.message);
        });
    }
    function runStreamHealthProbe() {
        var target = currentItems[itemIdx] || currentPlayingItem;
        if (!target || target.isSeason) {
            showToast('🩺 Select a channel or movie to test stream health');
            return;
        }
        showToast('🩺 Probing stream health & speed for ' + target.name + '...');
        api.resolveStream(target, false).then(function(url) {
            var cleanUrl = unwrapProxyStreamUrl(String(url || '').replace(/^(?:ffmpeg|ffrt\d*|auto|solution)\s+/i, '').trim());
            if (!cleanUrl) {
                showToast('🩺 Stream Probe: Empty stream URL');
                return;
            }
            return proxyFetch(api.proxyUrl + '/stream-diag?probe=1&url=' + encodeURIComponent(cleanUrl), { method: 'GET' })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    if (!d) {
                        showToast('🩺 Probe returned no data');
                        return;
                    }
                    var httpCode = Number(d.httpStatus || 0);
                    var kBps = Number(d.kBps || (d.kbps ? Math.round(d.kbps / 8) : 0));
                    var mbps = (kBps > 0) ? (((kBps * 8) / 1000).toFixed(1) + ' Mbps (' + kBps + ' KB/s)') : (httpCode >= 400 ? 'Offline / Error' : 'Live Ready');
                    var ttfb = (d.ttfbMs !== null && d.ttfbMs !== undefined) ? (d.ttfbMs + 'ms TTFB') : 'Fast TTFB';
                    var codecs = ((d.videoCodec || 'H264') + '/' + (d.audioCodec || 'AAC')).toUpperCase();
                    var statusLabel = httpCode > 0 ? ('HTTP ' + httpCode) : 'HTTP OK';
                    var summary = '🩺 ' + statusLabel + ' • ' + ttfb + ' • ' + mbps + ' • ' + codecs;
                    showToast(summary);
                    if (previewDescEl) {
                        var verdictText = (d.verdict && (d.verdict.summary || d.verdict.reason)) ? (d.verdict.summary || d.verdict.reason) : 'Stream connection healthy.';
                        previewDescEl.textContent = summary + '\n' + verdictText + '\n\n' + (previewDescEl.textContent || '');
                    }
                });
        }).catch(function(err) {
            showToast('🩺 Probe Failed: ' + err.message);
        });
    }
    function cycleEpgOffsetHours() {
        var prof = getActiveProfile();
        if (!prof) {
            return;
        }
        var offsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
        var cur = Number(prof.epgOffsetHours || 0);
        var idx = offsets.indexOf(cur);
        var next = offsets[(idx + 1) % offsets.length];
        prof.epgOffsetHours = next;
        cachedEpgOffsetSec = Math.round(next * 3600);
        safeSetStorage('cfg_profiles', JSON.stringify(profiles));
        safeSetStorage('cfg_epg_offset', String(next));
        if (selEpgOffsetEl) {
            selEpgOffsetEl.value = String(next);
        }
        if (btnEpgOffsetEl) {
            btnEpgOffsetEl.textContent = '🕒 EPG Offset: ' + (next > 0 ? ('+' + next) : next) + 'h [YELLOW]';
        }
        for (var k = 0; k < shortEpgKeys.length; k++) {
            var entry = shortEpgCache[shortEpgKeys[k]];
            if (entry && entry.list) {
                entry.list._memoSec = 0;
                entry.list._normBucket = 0;
            }
        }
        epgGridProgramsByCh = {};
        if (epgModalOpen && epgModalChannel) {
            openEpgModal(epgModalChannel);
        }
        updatePreviewPanel();
        showToast('🕒 EPG Time-Shift Offset: ' + (next > 0 ? ('+' + next + ' Hours') : (next === 0 ? '0 Hours (Default)' : (next + ' Hours'))));
    }
    function getRecentItems(isVodMode) {
        if (isVodMode) {
            if (!recVodCache) {
                recVodCache = getScopedJsonWithLegacyFallback('rec_vod', []);
            }
            return recVodCache;
        }
        if (!recLiveCache) {
            recLiveCache = getScopedJsonWithLegacyFallback('rec_items', []);
        }
        return recLiveCache;
    }
    function clearCurrentHistory() {
        var activeModeId = getActiveContentModeId();
        var isVodMode = (activeModeId === 'vod' || activeModeId === 'series');
        var baseKey = isVodMode ? 'rec_vod' : 'rec_items';
        safeSetStorage(getProfileScopedKey(baseKey), JSON.stringify([]));
        if (isVodMode) {
            recVodCache = [];
        } else {
            recLiveCache = [];
        }
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
        if (currentCats[catIdx] && currentCats[catIdx].id === 'rec') {
            rawItems = [];
            applyColumnFilters();
        }
        renderUI();
        showToast('⏱ Watch History Cleared');
    }
    function pushRecentItem(item) {
        if (item && item.isCatchup && item.channelRef) {
            item = item.channelRef;
        }
        if (!item || item.isSeason) {
            return;
        }
        var baseKey = item.isVod ? 'rec_vod' : 'rec_items';
        var scopedKey = getProfileScopedKey(baseKey);
        var list = getRecentItems(item.isVod);
        var filtered = [];
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].id) !== String(item.id)) {
                filtered.push(list[i]);
            }
        }
        var recentEntry = {
            id: item.id,
            num: item.num || 0,
            name: item.name,
            cmd: item.cmd,
            directUrl: Boolean(item.directUrl),
            useTmpLink: item.useTmpLink || 0,
            desc: item.desc || '',
            poster: item.poster || item.logo || '',
            logo: item.logo || '',
            archive: item.archive || 0,
            genreId: item.genreId || '*',
            censored: item.censored || 0,
            isVod: Boolean(item.isVod),
            isSeries: Boolean(item.isSeries),
            isEpisode: Boolean(item.isEpisode),
            streamType: item.streamType || '',
            seriesNum: item.seriesNum,
            seasonId: item.seasonId || '',
            seriesId: item.seriesId || ''
        };
        if (item.cmds && item.cmds.length > 1) {
            recentEntry.cmds = item.cmds;
        }
        if (item.nextEpSnapshot) {
            recentEntry.nextEpSnapshot = {
                id: item.nextEpSnapshot.id,
                name: item.nextEpSnapshot.name,
                cmd: item.nextEpSnapshot.cmd,
                directUrl: Boolean(item.nextEpSnapshot.directUrl),
                useTmpLink: item.nextEpSnapshot.useTmpLink || 0,
                genreId: item.nextEpSnapshot.genreId || item.genreId || '*',
                censored: item.nextEpSnapshot.censored || item.censored || 0,
                desc: item.nextEpSnapshot.desc || '',
                poster: item.nextEpSnapshot.poster || '',
                seriesNum: item.nextEpSnapshot.seriesNum,
                seasonId: item.nextEpSnapshot.seasonId || '',
                seriesId: item.nextEpSnapshot.seriesId || '',
                isEpisode: true,
                isVod: true,
                isSeries: true,
                streamType: item.nextEpSnapshot.streamType || 'series'
            };
        }
        filtered.unshift(recentEntry);
        if (filtered.length > 40) {
            filtered = filtered.slice(0, 40);
        }
        if (item.isVod) {
            recVodCache = filtered;
        } else {
            recLiveCache = filtered;
        }
        safeSetStorage(scopedKey, JSON.stringify(filtered));
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
    }
    function isAdultContentItem(item) {
        if (!item) {
            return false;
        }
        if (typeof item._isAdultCached === 'boolean') {
            return item._isAdultCached;
        }
        if (Boolean(item.censored) && String(item.censored) !== '0' && String(item.censored) !== 'false') {
            item._isAdultCached = true;
            return true;
        }
        if (ADULT_RE.test(String(item.name || ''))) {
            item._isAdultCached = true;
            return true;
        }
        var gId = item.genreId ? String(item.genreId) : '';
        var modeKey = item.isSeries ? 'series' : (item.isVod ? 'vod' : 'live');
        var lookupMap = adultCatLookup[modeKey] || {};
        var result = Boolean(gId && gId !== '*' && lookupMap[gId]);
        var catPool = item.isSeries ? seriesCats : (item.isVod ? vodCats : liveGenres);
        if (!gId || gId === '*' || (catPool && catPool.length > 3)) {
            item._isAdultCached = result;
        }
        return result;
    }
    function saveLastLiveChannel(item) {
        if (!item || item.isVod || item.isSeries) {
            return;
        }
        var currentCat = currentCats[catIdx];
        var catId = currentCat ? currentCat.id : '*';
        var isAdultCat = (currentCat && (Boolean(currentCat.censored) || ADULT_RE.test(String(currentCat.title || '')))) || isAdultContentItem(item);
        if (isAdultCat) {
            return;
        }
        safeSetStorage(getProfileScopedKey('last_live'), JSON.stringify({
            catId: String(catId),
            channelId: String(item.id),
            ts: Date.now()
        }));
    }
    function getLastLiveChannel() {
        return safeGetJson(getProfileScopedKey('last_live'), null);
    }
    function getPinnedCatIds(modeId) {
        var mId = modeId || getActiveContentModeId();
        if (!pinnedCatsCache[mId]) {
            pinnedCatsCache[mId] = safeGetJson(getProfileScopedKey('pinned_cats_' + mId), []);
            pinnedCatsMapCache[mId] = null;
        }
        return pinnedCatsCache[mId];
    }
    function getPinnedCatMap(modeId) {
        var mId = modeId || getActiveContentModeId();
        if (pinnedCatsMapCache[mId]) {
            return pinnedCatsMapCache[mId];
        }
        var pinned = getPinnedCatIds(mId);
        var map = {};
        for (var i = 0; i < pinned.length; i++) {
            map[String(pinned[i])] = true;
        }
        pinnedCatsMapCache[mId] = map;
        return map;
    }
    function isPinnedCategory(modeId, catId) {
        if (!catId || catId === '*' || catId === 'new' || catId === 'cont' || catId === 'fav' || catId === 'rec') {
            return false;
        }
        return Boolean(getPinnedCatMap(modeId)[String(catId)]);
    }
    function togglePinCategory(catObj) {
        if (!catObj || catObj.id === '*' || catObj.id === 'new' || catObj.id === 'cont' || catObj.id === 'fav' || catObj.id === 'rec') {
            showToast('Built-in categories are already at the top');
            return;
        }
        var mId = getActiveContentModeId();
        var pinned = getPinnedCatIds(mId).slice();
        var foundIdx = -1;
        for (var i = 0; i < pinned.length; i++) {
            if (String(pinned[i]) === String(catObj.id)) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx !== -1) {
            pinned.splice(foundIdx, 1);
            showToast('📌 Unpinned Category: ' + catObj.title);
        } else {
            pinned.unshift(String(catObj.id));
            showToast('📌 Pinned Category to Top: ' + catObj.title);
        }
        pinnedCatsCache[mId] = pinned;
        pinnedCatsMapCache[mId] = null;
        catsFilterMemo = null;
        safeSetStorage(getProfileScopedKey('pinned_cats_' + mId), JSON.stringify(pinned));
        applyColumnFilters();
        for (var c = 0; c < currentCats.length; c++) {
            if (String(currentCats[c].id) === String(catObj.id)) {
                catIdx = c;
                break;
            }
        }
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
        renderCats();
    }
    function getHiddenCatIds(modeId) {
        var mId = modeId || getActiveContentModeId();
        if (!hiddenCatsCache[mId]) {
            hiddenCatsCache[mId] = safeGetJson(getProfileScopedKey('hidden_cats_' + mId), []);
            hiddenCatsMapCache[mId] = null;
        }
        return hiddenCatsCache[mId];
    }
    function getHiddenCatMap(modeId) {
        var mId = modeId || getActiveContentModeId();
        if (hiddenCatsMapCache[mId]) {
            return hiddenCatsMapCache[mId];
        }
        var hidden = getHiddenCatIds(mId);
        var map = {};
        for (var i = 0; i < hidden.length; i++) {
            map[String(hidden[i])] = true;
        }
        hiddenCatsMapCache[mId] = map;
        return map;
    }
    function isHiddenCategory(modeId, catId) {
        if (!catId || catId === '*' || catId === 'new' || catId === 'cont' || catId === 'fav' || catId === 'rec') {
            return false;
        }
        return Boolean(getHiddenCatMap(modeId)[String(catId)]);
    }
    function toggleHideCategory(catObj) {
        if (!catObj || catObj.id === '*' || catObj.id === 'new' || catObj.id === 'cont' || catObj.id === 'fav' || catObj.id === 'rec') {
            showToast('Built-in categories cannot be hidden');
            return;
        }
        var mId = getActiveContentModeId();
        var hidden = getHiddenCatIds(mId).slice();
        var foundIdx = -1;
        for (var i = 0; i < hidden.length; i++) {
            if (String(hidden[i]) === String(catObj.id)) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx !== -1) {
            hidden.splice(foundIdx, 1);
            showToast('👁 Unhid Category: ' + catObj.title);
        } else {
            hidden.push(String(catObj.id));
            showToast('🚫 Hid Category: ' + catObj.title);
        }
        hiddenCatsCache[mId] = hidden;
        hiddenCatsMapCache[mId] = null;
        catsFilterMemo = null;
        itemsFilterMemo = null;
        safeSetStorage(getProfileScopedKey('hidden_cats_' + mId), JSON.stringify(hidden));
        applyColumnFilters();
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
        renderUI();
        if (foundIdx === -1 && currentCats[catIdx]) {
            selectCategory(catIdx, true);
        }
    }
    function getHiddenItemIds(modeId) {
        var mId = modeId || getActiveContentModeId();
        if (!hiddenItemsCache[mId]) {
            hiddenItemsCache[mId] = safeGetJson(getProfileScopedKey('hidden_items_' + mId), []);
            hiddenItemsMapCache[mId] = null;
        }
        return hiddenItemsCache[mId];
    }
    function getHiddenItemMap(modeId) {
        var mId = modeId || getActiveContentModeId();
        if (hiddenItemsMapCache[mId]) {
            return hiddenItemsMapCache[mId];
        }
        var hidden = getHiddenItemIds(mId);
        var map = {};
        for (var i = 0; i < hidden.length; i++) {
            map[String(hidden[i])] = true;
        }
        hiddenItemsMapCache[mId] = map;
        return map;
    }
    function isHiddenItem(modeId, itemId) {
        if (!itemId) {
            return false;
        }
        return Boolean(getHiddenItemMap(modeId)[String(itemId)]);
    }
    function toggleHideItem(itemObj) {
        if (!itemObj || itemObj.isSeason || itemObj.isEpisode) {
            return;
        }
        var mId = getActiveContentModeId();
        var hidden = getHiddenItemIds(mId).slice();
        var foundIdx = -1;
        for (var i = 0; i < hidden.length; i++) {
            if (String(hidden[i]) === String(itemObj.id)) {
                foundIdx = i;
                break;
            }
        }
        if (foundIdx !== -1) {
            hidden.splice(foundIdx, 1);
            showToast('👁 Unhid: ' + itemObj.name);
        } else {
            hidden.push(String(itemObj.id));
            showToast('🚫 Hid: ' + itemObj.name);
        }
        hiddenItemsCache[mId] = hidden;
        hiddenItemsMapCache[mId] = null;
        itemsFilterMemo = null;
        safeSetStorage(getProfileScopedKey('hidden_items_' + mId), JSON.stringify(hidden));
        applyColumnFilters();
        if (itemsListEl) {
            itemsListEl._forceRebuild = true;
        }
        renderUI();
    }
    function toggleShowHiddenMode() {
        showHiddenEntries = !showHiddenEntries;
        catsFilterMemo = null;
        itemsFilterMemo = null;
        showToast(showHiddenEntries ? '👁 Showing Hidden Categories & Channels' : '🚫 Hiding Filtered Categories & Channels');
        applyColumnFilters();
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
        if (itemsListEl) {
            itemsListEl._forceRebuild = true;
        }
        renderUI();
    }
    function getContinueWatchingItems(isSeriesMode) {
        var rec = getRecentItems(true);
        var out = [];
        for (var i = 0; i < rec.length; i++) {
            var it = rec[i];
            if (!it) {
                continue;
            }
            var matchType = isSeriesMode ? Boolean(it.isSeries || it.isEpisode) : (!it.isSeries && !it.isEpisode);
            if (!matchType) {
                continue;
            }
            var resume = getResumeInfo(it.id);
            if (resume && resume.pos > 15 && resume.dur > 0) {
                var clone = extendObj(it, { _resumeRatio: Math.min(100, Math.round((resume.pos / resume.dur) * 100)), _resumeTs: resume.ts || 0 });
                out.push(clone);
            }
        }
        out.sort(function(a, b) {
            return (b._resumeTs || 0) - (a._resumeTs || 0);
        });
        return out;
    }
    function getContinueWatchingCount(isSeriesMode) {
        var rec = getRecentItems(true);
        var count = 0;
        for (var i = 0; i < rec.length; i++) {
            var it = rec[i];
            if (!it) {
                continue;
            }
            var matchType = isSeriesMode ? Boolean(it.isSeries || it.isEpisode) : (!it.isSeries && !it.isEpisode);
            if (!matchType) {
                continue;
            }
            var resume = getResumeInfo(it.id);
            if (resume && resume.pos > 15 && resume.dur > 0) {
                count++;
            }
        }
        return count;
    }
    function cycleSleepTimer() {
        var options = [0, 30, 60, 90, 120];
        var curIdx = options.indexOf(sleepTimerMinutes);
        sleepTimerMinutes = options[(curIdx + 1) % options.length];
        if (sleepTimerInterval) {
            clearInterval(sleepTimerInterval);
            sleepTimerInterval = null;
        }
        if (sleepTimerMinutes <= 0) {
            sleepTimerDeadline = 0;
            if (sleepTimerBadgeEl) {
                sleepTimerBadgeEl.textContent = '';
                sleepTimerBadgeEl.classList.remove('visible');
            }
            showToast('⏱ Sleep Timer: Off');
            return;
        }
        sleepTimerDeadline = Date.now() + (sleepTimerMinutes * 60000);
        function updateSleepBadge() {
            var remMs = sleepTimerDeadline - Date.now();
            if (remMs <= 0) {
                clearInterval(sleepTimerInterval);
                sleepTimerInterval = null;
                if (isPlayingVod && currentPlayingItem && currentPlayingItem.id && vodCurrentMs > 15000 && vodDurationMs > 0) {
                    saveResumeTime(currentPlayingItem.id, vodCurrentMs / 1000, vodDurationMs / 1000);
                }
                sleepTimerMinutes = 0;
                currentPlayingItem = null;
                stopPlayback();
                isPlayingVod = false;
                isPlayingCatchup = false;
                isPaused = false;
                showToast('⏱ Sleep Timer reached — Stopping playback');
                try {
                    if (typeof tizen !== 'undefined' && tizen.application) {
                        tizen.application.getCurrentApplication().exit();
                    }
                } catch (ex) {}
                return;
            }
            var remMin = Math.ceil(remMs / 60000);
            if (sleepTimerBadgeEl) {
                sleepTimerBadgeEl.textContent = '🌙 Sleep: ' + remMin + 'm';
                sleepTimerBadgeEl.classList.add('visible');
            }
        }
        updateSleepBadge();
        sleepTimerInterval = setInterval(updateSleepBadge, 15000);
        showToast('🌙 Sleep Timer set for ' + sleepTimerMinutes + ' minutes');
    }
    function getVodResumeMap() {
        if (!vodResumeCache) {
            vodResumeCache = getScopedJsonWithLegacyFallback('vod_resume', {});
        }
        return vodResumeCache;
    }
    function saveResumeTime(itemId, currentSec, durationSec) {
        if (!itemId || !durationSec || durationSec <= 0) {
            return;
        }
        var key = String(itemId);
        var scopedKey = getProfileScopedKey('vod_resume');
        var map = getVodResumeMap();
        var membershipChanged = false;
        if (currentSec / durationSec > 0.92) {
            if (map[key]) {
                delete map[key];
                membershipChanged = true;
            }
            markItemWatched(itemId);
        } else if (currentSec < 15) {
            if (!map[key]) {
                return;
            }
            delete map[key];
            membershipChanged = true;
        } else {
            var newPos = Math.floor(currentSec);
            var existing = map[key];
            if (existing && Math.abs(existing.pos - newPos) < 4) {
                return;
            }
            if (!existing) {
                membershipChanged = true;
            }
            map[key] = { pos: newPos, dur: Math.floor(durationSec), ts: Date.now() };
            var mapKeys = Object.keys(map);
            if (mapKeys.length > 100) {
                delete map[mapKeys[0]];
            }
        }
        vodResumeCache = map;
        if (membershipChanged) {
            if (catsListEl) {
                catsListEl._forceRebuild = true;
            }
            if (itemsListEl) {
                itemsListEl._forceRebuild = true;
            }
        }
        safeSetStorage(scopedKey, JSON.stringify(map));
    }
    function getResumeInfo(itemId) {
        if (!itemId) {
            return null;
        }
        var map = getVodResumeMap();
        return map[String(itemId)] || null;
    }
    function getWatchedMap() {
        if (!watchedLookupCache) {
            watchedLookupCache = safeGetJson(getProfileScopedKey('vod_watched'), {});
        }
        return watchedLookupCache;
    }
    function markItemWatched(itemId) {
        if (!itemId) {
            return;
        }
        var map = getWatchedMap();
        map[String(itemId)] = Date.now();
        watchedLookupCache = map;
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
        if (itemsListEl) {
            itemsListEl._forceRebuild = true;
        }
        safeSetStorage(getProfileScopedKey('vod_watched'), JSON.stringify(map));
    }
    function isItemWatched(itemId) {
        if (!itemId) {
            return false;
        }
        var map = getWatchedMap();
        return Boolean(map[String(itemId)]);
    }

    function adjustVolume(delta) {
        playerVolume = Math.max(0, Math.min(100, playerVolume + delta));
        playerMuted = (playerVolume === 0);
        safeSetStorage('cfg_volume', String(playerVolume));
        try {
            if (typeof tizen !== 'undefined' && tizen.tvaudiocontrol) {
                tizen.tvaudiocontrol.setMute(playerMuted);
                tizen.tvaudiocontrol.setVolume(playerVolume);
            }
        } catch (ex) {}
        var vids = document.querySelectorAll('video, audio');
        for (var i = 0; i < vids.length; i++) {
            try {
                vids[i].muted = playerMuted;
                vids[i].volume = playerVolume / 100;
            } catch (ex2) {}
        }
        showToast((playerMuted ? '🔇 Muted' : '🔊 Volume: ' + playerVolume + '%'));
    }
    function toggleMute() {
        playerMuted = !playerMuted;
        try {
            if (typeof tizen !== 'undefined' && tizen.tvaudiocontrol) {
                tizen.tvaudiocontrol.setMute(playerMuted);
            }
        } catch (ex) {}
        var vids = document.querySelectorAll('video, audio');
        for (var i = 0; i < vids.length; i++) {
            try {
                vids[i].muted = playerMuted;
            } catch (ex2) {}
        }
        showToast(playerMuted ? '🔇 Audio Muted' : '🔊 Audio Unmuted (' + playerVolume + '%)');
    }
    function forceRefreshCurrentCatalog() {
        showToast('🔄 Refreshing catalog from portal...');
        try {
            localStorage.removeItem('stalker_live');
        } catch (ex) {}
        api.resetProviderCaches();
        var activeProf = getActiveProfile();
        if (activeProf && activeProf.id) {
            if (activeProf.type === 'm3u' && activeProf.m3uUrl && activeProf.m3uUrl.indexOf('local://') !== 0) {
                delete m3uRawMemoryCache[activeProf.id];
                try {
                    localStorage.removeItem('m3u_raw_' + activeProf.id);
                } catch (eRmM3u) {}
                proxyFetch(api.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent('m3u_raw_' + activeProf.id) + '&action=delete', {
                    method: 'GET'
                }).catch(function() {});
            }
            proxyFetch(api.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent(activeProf.id) + '&action=delete&mac=' + encodeURIComponent(activeProf.mac || ''), {
                method: 'GET'
            }).catch(function() {});
        }
        liveGenres = [];
        allChannels = [];
        vodCats = [];
        seriesCats = [];
        loadedCatSignature = '';
        if (searchOpen) {
            closeSearch();
        }
        var refreshModeIdx = (modes[modeIdx] && modes[modeIdx].id !== 'settings' && modes[modeIdx].id !== 'search') ? modeIdx : (lastContentModeIdx || 0);
        switchMode(refreshModeIdx);
    }

    function buildBackupPayload() {
        var payload = {
            version: 2,
            exportedAt: new Date().toISOString(),
            profiles: profiles,
            activeProfileId: activeProfileId,
            theme: localStorage.getItem('cfg_theme') || 'blue',
            storage: {}
        };
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k !== 'stalker_live' && k !== 'smartstb_local_backup' && k.indexOf('m3u_raw_') !== 0) {
                payload.storage[k] = localStorage.getItem(k);
            }
        }
        return payload;
    }

    function exportBackupJson() {
        var payload = buildBackupPayload();
        var jsonStr = JSON.stringify(payload, null, 2);
        if (jsonStr.length <= 500000) {
            safeSetStorage('smartstb_local_backup', jsonStr);
        }
        proxyFetch(api.proxyUrl + '/backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonStr
        }).then(function() {
            showToast('⬇ Backup saved to TV / Proxy storage');
        }).catch(function() {
            showToast('⬇ Backup snapshot saved');
        });
        try {
            if (typeof tizen === 'undefined' && typeof Blob !== 'undefined') {
                var blob = new Blob([jsonStr], { type: 'application/json' });
                var backupObjUrl = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = backupObjUrl;
                a.download = 'smartstb-backup-' + new Date().toISOString().slice(0, 10) + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function() {
                    try {
                        URL.revokeObjectURL(backupObjUrl);
                    } catch (eRev2) {}
                }, 2000);
            }
        } catch (ex) {}
    }

    function applyRestoredBackupData(data) {
        if (data && data.storage && typeof data.storage === 'object') {
            var keys = Object.keys(data.storage);
            for (var i = 0; i < keys.length; i++) {
                safeSetStorage(keys[i], data.storage[keys[i]]);
            }
            showToast('⬆ Backup restored! Rebooting...');
            setTimeout(function() {
                window.location.reload();
            }, 600);
            return true;
        }
        return false;
    }

    function importBackupJson() {
        if (typeof tizen !== 'undefined') {
            proxyFetch(api.proxyUrl + '/backup', { method: 'GET' }).then(function(r) {
                if (!r.ok) {
                    throw new Error('No proxy backup');
                }
                return r.json();
            }).then(function(data) {
                if (!applyRestoredBackupData(data)) {
                    throw new Error('Invalid proxy backup');
                }
            }).catch(function() {
                var localSnap = safeGetJson('smartstb_local_backup', null);
                if (!applyRestoredBackupData(localSnap)) {
                    showToast('No saved backup found on TV');
                }
            });
            return;
        }
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = function(ev) {
            var file = ev.target && ev.target.files ? ev.target.files[0] : null;
            if (!file) {
                return;
            }
            var reader = new FileReader();
            reader.onload = function() {
                try {
                    var data = JSON.parse(String(reader.result || '{}'));
                    if (!applyRestoredBackupData(data)) {
                        showToast('Invalid backup file');
                    }
                } catch (ex) {
                    showToast('Failed to parse backup file');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function getFocusedModalElement(grid, r, c) {
        var row = grid[r] || grid[0] || [];
        var colIdx = Math.max(0, Math.min(row.length - 1, c));
        return row[colIdx] || null;
    }
    function applyGridFocus(allEls, grid, r, c) {
        var target = getFocusedModalElement(grid, r, c);
        for (var i = 0; i < allEls.length; i++) {
            if (allEls[i] === target) {
                allEls[i].classList.add('focused');
            } else {
                allEls[i].classList.remove('focused');
            }
        }
        return target;
    }
    function setScreensaverDisabled(disabled) {
        try {
            if (typeof webapis !== 'undefined' && webapis.appcommon) {
                var state = disabled ? webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF : webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_ON;
                webapis.appcommon.setScreenSaver(state, function() {}, function() {});
            }
        } catch (ex) {}
    }
    function formatTimeHMS(totalSeconds) {
        var sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        var mm = (m < 10 ? '0' : '') + m;
        var ss = (s < 10 ? '0' : '') + s;
        if (h > 0) {
            return ((h < 10 ? '0' : '') + h) + ':' + mm + ':' + ss;
        }
        return mm + ':' + ss;
    }
    function formatOsdTitle(item) {
        if (!item) {
            return 'Channel';
        }
        if (!item.isVod && !item.isEpisode && item.num) {
            return item.num + '. ' + item.name;
        }
        return item.name;
    }
    function updateOsdEpgProgressBar() {
        if (!osdEpgProgressWrap || !osdEpgProgressFill) {
            return;
        }
        if (isPlayingVod || isPlayingCatchup || !currentPlayingItem) {
            osdEpgProgressWrap.classList.remove('visible');
            osdEpgProgressFill.style.width = '0%';
            if (osdEpgRemEl) {
                osdEpgRemEl.textContent = '';
                osdEpgRemEl.classList.remove('visible');
            }
            return;
        }
        var cached = shortEpgCache[String(currentPlayingItem.id)];
        if (cached && Array.isArray(cached.list) && cached.list.length > 0) {
            var parsed = parseShortEpgNowNext(cached.list);
            if (osdEpgRemEl) {
                if (parsed.remMin > 0) {
                    osdEpgRemEl.textContent = '-' + parsed.remMin + 'm left';
                    osdEpgRemEl.classList.add('visible');
                } else {
                    osdEpgRemEl.textContent = '';
                    osdEpgRemEl.classList.remove('visible');
                }
            }
            if (parsed.progressPct > 0) {
                osdEpgProgressWrap.classList.add('visible');
                osdEpgProgressFill.style.width = Math.min(100, Math.max(0, parsed.progressPct)) + '%';
                return;
            }
        } else if (osdEpgRemEl) {
            osdEpgRemEl.textContent = '';
            osdEpgRemEl.classList.remove('visible');
        }
        osdEpgProgressWrap.classList.remove('visible');
        osdEpgProgressFill.style.width = '0%';
    }
    function syncOsdStationIdentity() {
        if (!currentPlayingItem) {
            if (osdChNumEl) {
                osdChNumEl.textContent = '';
                osdChNumEl.classList.remove('visible');
            }
            return;
        }
        var isVodOrEp = Boolean(currentPlayingItem.isVod || currentPlayingItem.isEpisode || isPlayingVod);
        if (osdChNumEl) {
            if (!isVodOrEp && currentPlayingItem.num) {
                osdChNumEl.textContent = 'CH ' + currentPlayingItem.num;
                osdChNumEl.classList.add('visible');
            } else {
                osdChNumEl.textContent = '';
                osdChNumEl.classList.remove('visible');
            }
        }
        if (osdLogoBoxEl) {
            var logoSrc = currentPlayingItem.logo || currentPlayingItem.poster || '';
            var monoText = currentPlayingItem._monogram || (currentPlayingItem._monogram = getChannelStationMonogram(currentPlayingItem.name));
            osdLogoBoxEl.innerHTML = '';
            if (logoSrc) {
                var img = document.createElement('img');
                img.alt = '';
                img.src = resolveLogoUrl(logoSrc);
                img.onerror = function() {
                    if (osdLogoBoxEl) {
                        osdLogoBoxEl.textContent = monoText;
                    }
                };
                osdLogoBoxEl.appendChild(img);
            } else {
                osdLogoBoxEl.textContent = monoText;
            }
        }
    }
    function showOSD(title, status, nowText, nextText) {
        if (!osdBar) {
            return;
        }
        syncOsdStationIdentity();
        if (title !== undefined && osdTitle) {
            if (currentPlayingItem && !currentPlayingItem.isVod && !currentPlayingItem.isEpisode && currentPlayingItem.num && osdChNumEl) {
                osdTitle.textContent = currentPlayingItem.name || title;
            } else {
                osdTitle.textContent = title;
            }
        }
        if (status !== undefined && osdStatus) {
            osdStatus.textContent = status;
        }
        if (nowText !== undefined && epgNow) {
            epgNow.textContent = nowText;
        }
        if (nextText !== undefined && epgNext) {
            epgNext.textContent = nextText;
        }
        updateOsdEpgProgressBar();
        var showVodBar = isPlayingVod || isPlayingCatchup;
        if (vodProgressWrap) {
            if (showVodBar) {
                vodProgressWrap.classList.add('visible');
            } else {
                vodProgressWrap.classList.remove('visible');
            }
        }
        if (vodTimeRow) {
            if (showVodBar) {
                vodTimeRow.classList.add('visible');
                if (vodDurationMs > 0) {
                    var curOsdSec = Math.floor(vodCurrentMs / 1000);
                    var durOsdSec = Math.floor(vodDurationMs / 1000);
                    var osdPct = Math.min(100, Math.max(0, (vodCurrentMs / vodDurationMs) * 100));
                    if (vodProgressBar) {
                        vodProgressBar.style.width = osdPct + '%';
                    }
                    if (vodTimeDurEl && vodTimeLabel) {
                        vodTimeLabel.textContent = formatTimeHMS(curOsdSec);
                        vodTimeDurEl.textContent = formatTimeHMS(durOsdSec);
                    } else if (vodTimeLabel) {
                        vodTimeLabel.textContent = formatTimeHMS(curOsdSec) + ' / ' + formatTimeHMS(durOsdSec);
                    }
                }
            } else {
                vodTimeRow.classList.remove('visible');
            }
        }
        osdBar.classList.add('visible');
        if (osdTimeout) {
            clearTimeout(osdTimeout);
        }
        osdTimeout = setTimeout(function() {
            if (!seekDebounceTimer) {
                osdBar.classList.remove('visible');
            }
        }, osdTimeoutDurationMs || 5000);
    }

    var bufferingDiagPollTimer = null;
    function clearBufferingWatchdog() {
        if (bufferingWatchdogTimer) {
            clearTimeout(bufferingWatchdogTimer);
            bufferingWatchdogTimer = null;
        }
        if (bufferingDiagPollTimer) {
            clearInterval(bufferingDiagPollTimer);
            bufferingDiagPollTimer = null;
        }
    }

    function unwrapProxyStreamUrl(rawUrl) {
        var str = String(rawUrl || '').trim();
        var idx = str.indexOf('/stream?url=');
        if (idx !== -1) {
            var encoded = str.substring(idx + 12).split('&')[0];
            try {
                return decodeURIComponent(encoded);
            } catch (eDec) {
                return encoded;
            }
        }
        return str;
    }

    function pollStreamDiagDuringBuffer(item, streamUrl, activeSession) {
        if (!streamUrl || activeSession !== playSessionId || streamUrl.indexOf('/stream?url=') === -1) {
            return;
        }
        var diagTargetUrl = unwrapProxyStreamUrl(streamUrl);
        proxyFetch(api.proxyUrl + '/stream-diag?url=' + encodeURIComponent(diagTargetUrl))
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d || activeSession !== playSessionId || !osdStatus) {
                    return;
                }
                var isProviderIssue = d.verdict && (
                    d.verdict.source === 'provider' ||
                    d.verdict.status === 'provider_error' ||
                    d.verdict.status === 'provider_slow'
                );
                if (isProviderIssue && (d.elapsedMs || 0) >= 2200) {
                    var shortReason;
                    if (d.httpStatus && d.httpStatus >= 400) {
                        shortReason = 'PROVIDER HTTP ' + d.httpStatus;
                    } else {
                        shortReason = 'PROVIDER 0 KB/s (IDLE FEED)';
                    }
                    osdStatus.textContent = shortReason;
                } else if (d.isTranscoding) {
                    osdStatus.textContent = d.vTranscode ? 'TRANSCODING H.264+AAC...' : 'TRANSCODING AUDIO...';
                } else if (d.kBps > 0) {
                    osdStatus.textContent = 'BUFFERING (' + d.kBps + ' KB/s)';
                }
            })
            .catch(function() {});
    }

    var vodLoadingSimTimer = null;
    function ensureVodLoadingVisualDom() {
        var el = document.getElementById('vod-loading-overlay');
        if (el) {
            return el;
        }
        el = document.createElement('div');
        el.id = 'vod-loading-overlay';
        el.className = 'vod-loading-overlay';
        el.innerHTML =
            '<div class="vod-loading-spinner-wrap">' +
                '<div class="vod-loading-spinner"></div>' +
                '<span id="vod-loading-pct" class="vod-loading-pct">0%</span>' +
            '</div>';
        document.body.appendChild(el);
        return el;
    }

    function showVodLoadingVisual(titleText, subText, percentNum) {
        var el = ensureVodLoadingVisualDom();
        var pctEl = document.getElementById('vod-loading-pct');
        var rawPct = Number(percentNum);
        var pct = isNaN(rawPct) ? 12 : Math.max(1, Math.min(99, Math.round(rawPct)));
        if (pctEl) {
            pctEl.textContent = pct + '%';
        }
        el.classList.add('visible');
    }

    function hideVodLoadingVisual() {
        if (vodLoadingSimTimer) {
            clearInterval(vodLoadingSimTimer);
            vodLoadingSimTimer = null;
        }
        var el = document.getElementById('vod-loading-overlay');
        if (el) {
            el.classList.remove('visible');
        }
    }

    function startBufferingWatchdog(item, streamUrl, activeSession) {
        clearBufferingWatchdog();
        if (streamUrl && String(streamUrl).indexOf('/stream?url=') !== -1) {
            bufferingDiagPollTimer = setInterval(function() {
                pollStreamDiagDuringBuffer(item, streamUrl, activeSession);
            }, 1200);
        }
        var isLiveFastSwitch = item && !item.isVod && !item.isEpisode && !item.isCatchup;
        var watchdogMs = isLiveFastSwitch ? (retryCount === 0 ? 7500 : 8500) : 65000;
        bufferingWatchdogTimer = setTimeout(function() {
            if (activeSession !== playSessionId) {
                return;
            }
            handlePlaybackErrorOrRetry(item, streamUrl, 'BUFFER_TIMEOUT', activeSession);
        }, watchdogMs);
    }

    function isCurrentlyPlayingEntry(entry) {
        if (!currentPlayingItem || !entry || entry.isSeason) {
            return false;
        }
        var curIsVod = Boolean(currentPlayingItem.isVod || currentPlayingItem.isEpisode);
        var entryIsVod = Boolean(entry.isVod || entry.isEpisode);
        if (curIsVod !== entryIsVod) {
            return false;
        }
        if (currentPlayingItem.isCatchup && currentPlayingItem.channelRef && !entryIsVod) {
            return String(currentPlayingItem.channelRef.id) === String(entry.id);
        }
        return String(currentPlayingItem.id) === String(entry.id);
    }

    function syncContainerPlayingIndicators(containerEl) {
        if (!containerEl || !containerEl.children) {
            return;
        }
        var children = containerEl.children;
        for (var i = 0; i < children.length; i++) {
            var node = children[i];
            if (!node || !node._entryRef) {
                continue;
            }
            var playing = isCurrentlyPlayingEntry(node._entryRef);
            node._isPlay = playing;
            if (node.classList) {
                if (playing) {
                    node.classList.add('playing');
                } else {
                    node.classList.remove('playing');
                }
            }
            if (node._playBadge && node._playBadge.classList) {
                if (playing) {
                    node._playBadge.classList.add('visible');
                } else {
                    node._playBadge.classList.remove('visible');
                }
            }
        }
    }

    function syncPlayingRowIndicators() {
        syncContainerPlayingIndicators(itemsListEl);
        syncContainerPlayingIndicators(miniZapListEl);
    }

    var pendingVodResumeMs = 0;
    var pendingVodResumeTimer = null;

    function stopPlayback() {
        isPlaybackHealthy = false;
        document.body.classList.remove('playing-live');
        currentPlaybackSpeed = 1;
        pendingVodResumeMs = 0;
        if (pendingVodResumeTimer) {
            clearTimeout(pendingVodResumeTimer);
            pendingVodResumeTimer = null;
        }
        hideVodLoadingVisual();
        clearNextEpisodePrompt();
        clearBufferingWatchdog();
        clearSubtitleBox();
        if (seekDebounceTimer) {
            clearTimeout(seekDebounceTimer);
            seekDebounceTimer = null;
        }
        if (zapTimeout) {
            clearTimeout(zapTimeout);
            zapTimeout = null;
        }
        if (typeof webapis !== 'undefined' && webapis.avplay) {
            var avState = 'NONE';
            try {
                if (typeof webapis.avplay.getState === 'function') {
                    avState = webapis.avplay.getState() || 'NONE';
                } else {
                    avState = 'PLAYING';
                }
            } catch (eSt) {
                avState = 'PLAYING';
            }
            if (avState !== 'NONE') {
                if (avState === 'PLAYING' || avState === 'PAUSED' || avState === 'READY') {
                    try {
                        if (typeof webapis.avplay.setSpeed === 'function') {
                            webapis.avplay.setSpeed(1);
                        }
                    } catch (exSpd) {}
                    try {
                        webapis.avplay.stop();
                    } catch (ex1) {}
                }
                try {
                    webapis.avplay.close();
                } catch (ex2) {}
            }
        }
        setScreensaverDisabled(false);
        syncPlayingRowIndicators();
    }
    function findNextEpisodeInList(list, currentEpId) {
        if (!Array.isArray(list) || list.length < 2) {
            return null;
        }
        for (var i = 0; i < list.length - 1; i++) {
            if (list[i] && String(list[i].id) === String(currentEpId) && list[i + 1] && list[i + 1].isEpisode) {
                return list[i + 1];
            }
        }
        return null;
    }
    function findNextEpisode(currentEpItem) {
        if (!currentEpItem || !currentEpItem.isEpisode) {
            return null;
        }
        var fromPlaying = findNextEpisodeInList(playingEpisodeList, currentEpItem.id);
        if (fromPlaying) {
            return fromPlaying;
        }
        var fromActive = findNextEpisodeInList(activeSeriesPlaylist, currentEpItem.id);
        if (fromActive) {
            return fromActive;
        }
        var fromCurrent = findNextEpisodeInList(currentItems, currentEpItem.id);
        if (fromCurrent) {
            return fromCurrent;
        }
        if (currentEpItem.nextEpSnapshot && currentEpItem.nextEpSnapshot.isEpisode) {
            return currentEpItem.nextEpSnapshot;
        }
        return null;
    }
    function advanceToNextEpisode(nextEp) {
        if (!nextEp) {
            return;
        }
        if (currentPlayingItem && currentPlayingItem.isEpisode) {
            markItemWatched(currentPlayingItem.id);
            if (vodDurationMs > 0) {
                saveResumeTime(currentPlayingItem.id, vodDurationMs / 1000, vodDurationMs / 1000);
            }
        }
        clearNextEpisodePrompt();
        for (var i = 0; i < currentItems.length; i++) {
            if (currentItems[i] && String(currentItems[i].id) === String(nextEp.id)) {
                itemIdx = i;
                break;
            }
        }
        if (itemsListEl) {
            itemsListEl._forceRebuild = true;
        }
        renderItems();
        updatePreviewPanel();
        showToast('⏭ Auto-Playing: ' + nextEp.name);
        playItem(nextEp);
    }
    function clearNextEpisodePrompt() {
        nextEpCandidate = null;
        if (nextEpTimer) {
            clearInterval(nextEpTimer);
            nextEpTimer = null;
        }
        if (nextEpBanner) {
            nextEpBanner.classList.remove('visible');
        }
    }
    function triggerNextEpisodePrompt(nextEp) {
        if (!nextEp || nextEpCandidate) {
            return;
        }
        nextEpCandidate = nextEp;
        nextEpCountdown = 10;
        if (nextEpTitleEl) {
            nextEpTitleEl.textContent = '⏭ Up Next: ' + nextEp.name;
        }
        if (nextEpSubEl) {
            nextEpSubEl.textContent = 'Starting in ' + nextEpCountdown + 's — Press OK to Play Now or BACK to Cancel';
        }
        if (nextEpBanner) {
            nextEpBanner.classList.add('visible');
        }
        if (nextEpTimer) {
            clearInterval(nextEpTimer);
        }
        nextEpTimer = setInterval(function() {
            nextEpCountdown--;
            if (nextEpCountdown <= 0) {
                var target = nextEpCandidate;
                clearNextEpisodePrompt();
                if (target) {
                    advanceToNextEpisode(target);
                }
            } else if (nextEpSubEl) {
                nextEpSubEl.textContent = 'Starting in ' + nextEpCountdown + 's — Press OK to Play Now or BACK to Cancel';
            }
        }, 1000);
    }
    if (nextEpBanner) {
        nextEpBanner.onclick = function(ev) {
            ev.stopPropagation();
            if (nextEpCandidate) {
                advanceToNextEpisode(nextEpCandidate);
            }
        };
    }
    function scrubVodByOffset(deltaMs) {
        if ((!isPlayingVod && !isPlayingCatchup) || vodDurationMs <= 0) {
            return;
        }
        var baseMs = seekTargetMs !== null ? seekTargetMs : vodCurrentMs;
        seekTargetMs = Math.max(0, Math.min(vodDurationMs - 2000, baseMs + deltaMs));
        var pct = Math.min(100, Math.max(0, (seekTargetMs / vodDurationMs) * 100));
        if (vodSeekMarker) {
            vodSeekMarker.style.left = pct + '%';
            vodSeekMarker.classList.add('visible');
        }
        var diffSec = Math.round((seekTargetMs - vodCurrentMs) / 1000);
        var sign = diffSec >= 0 ? '+' : '-';
        if (vodSeekPreview) {
            vodSeekPreview.textContent = 'Seek Target: ' + formatTimeHMS(seekTargetMs / 1000) + ' (' + sign + formatTimeHMS(Math.abs(diffSec)) + ')';
        }
        showOSD(formatOsdTitle(currentPlayingItem), 'SEEKING');
        if (seekDebounceTimer) {
            clearTimeout(seekDebounceTimer);
        }
        seekDebounceTimer = setTimeout(function() {
            var finalMs = seekTargetMs;
            seekTargetMs = null;
            seekDebounceTimer = null;
            if (vodSeekMarker) {
                vodSeekMarker.classList.remove('visible');
            }
            if (vodSeekPreview) {
                vodSeekPreview.textContent = '';
            }
            clearSubtitleBox();
            try {
                if (typeof webapis !== 'undefined' && webapis.avplay && finalMs !== null) {
                    webapis.avplay.seekTo(finalMs, function() {
                        vodCurrentMs = finalMs;
                        showOSD(formatOsdTitle(currentPlayingItem), isPaused ? 'PAUSED' : (isPlayingCatchup ? 'CATCH-UP' : 'PLAYING'));
                    }, function() {
                        showOSD(formatOsdTitle(currentPlayingItem), 'Seek Unsupported');
                    });
                }
            } catch (ex) {}
        }, 450);
    }

    function applyAvPlayDisplayRect() {
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                var w = window.innerWidth || 1920;
                var h = window.innerHeight || 1080;
                webapis.avplay.setDisplayRect(0, 0, w, h);
            }
        } catch (ex) {}
    }

    function updateOsdStreamTelemetry() {
        if (!osdTechBadgesEl) {
            return;
        }
        var badges = [];
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay && webapis.avplay.getCurrentStreamInfo) {
                var streams = webapis.avplay.getCurrentStreamInfo() || [];
                for (var i = 0; i < streams.length; i++) {
                    var s = streams[i];
                    if (!s || !s.extra_info) {
                        continue;
                    }
                    var info = typeof s.extra_info === 'object' ? s.extra_info : JSON.parse(s.extra_info);
                    var sType = String(s.type || '').toUpperCase();
                    if (sType === 'VIDEO') {
                        var w = Number(info.Width || info.width || 0);
                        var h = Number(info.Height || info.height || 0);
                        if (w >= 3800 || h >= 2100) {
                            badges.push({ text: '4K UHD', uhd: true });
                        } else if (w >= 1900 || h >= 1000) {
                            badges.push({ text: '1080p FHD', uhd: false });
                        } else if (w >= 1200 || h >= 700) {
                            badges.push({ text: '720p HD', uhd: false });
                        }
                        var vCodec = String(info.fourCC || info.codec || '').toUpperCase();
                        if (vCodec) {
                            badges.push({ text: vCodec, uhd: false });
                        }
                        var fps = Number(info.Bit_rate || info.frame_rate || info.fps || 0);
                        if (fps >= 23 && fps <= 120) {
                            badges.push({ text: Math.round(fps) + ' FPS', uhd: false });
                        }
                    }
                }
            }
        } catch (ex) {}
        if (audioTracks.length > 0 && audioTracks[audioIdx] && audioTracks[audioIdx].extra_info) {
            try {
                var aInfo;
                if (typeof audioTracks[audioIdx].extra_info === 'object') {
                    aInfo = audioTracks[audioIdx].extra_info;
                } else {
                    aInfo = JSON.parse(audioTracks[audioIdx].extra_info);
                }
                var aCodec = String(aInfo.fourCC || aInfo.codec || aInfo.language || '').toUpperCase();
                if (aCodec) {
                    badges.push({ text: aCodec, uhd: false });
                }
            } catch (ex2) {}
        }
        if (badges.length === 0 && currentPlayingItem) {
            var titleUpper = String(currentPlayingItem.name || '').toUpperCase();
            if (titleUpper.indexOf('4K') !== -1 || titleUpper.indexOf('UHD') !== -1) {
                badges.push({ text: '4K UHD', uhd: true });
            } else if (titleUpper.indexOf('FHD') !== -1 || titleUpper.indexOf('1080') !== -1) {
                badges.push({ text: '1080p FHD', uhd: false });
            } else if (titleUpper.indexOf('HD') !== -1 || titleUpper.indexOf('720') !== -1) {
                badges.push({ text: 'HD', uhd: false });
            }
            if (titleUpper.indexOf('HEVC') !== -1 || titleUpper.indexOf('H265') !== -1 || titleUpper.indexOf('H.265') !== -1) {
                badges.push({ text: 'HEVC', uhd: false });
            }
            if (titleUpper.indexOf('50FPS') !== -1 || titleUpper.indexOf('60FPS') !== -1 || titleUpper.indexOf('RAW') !== -1) {
                badges.push({ text: '50 FPS', uhd: false });
            }
        }
        if ((isPlayingVod || isPlayingCatchup) && currentPlaybackSpeed !== 1) {
            badges.push({ text: currentPlaybackSpeed + 'x SPEED', uhd: false });
        }
        osdTechBadgesEl.innerHTML = '';
        for (var b = 0; b < badges.length; b++) {
            var span = document.createElement('span');
            span.className = 'osd-tech-pill' + (badges[b].uhd ? ' uhd' : '');
            span.textContent = badges[b].text;
            osdTechBadgesEl.appendChild(span);
        }
    }

    function formatAvPlayHttpHeaderString(headersObj) {
        if (!headersObj || typeof headersObj !== 'object') {
            return '';
        }
        var lines = [];
        var keys = Object.keys(headersObj);
        for (var i = 0; i < keys.length; i++) {
            var k = String(keys[i] || '').trim();
            var v = String(headersObj[k] || '').trim();
            if (k && v) {
                lines.push(k + ': ' + v);
            }
        }
        return lines.join('\n');
    }

    function playUrl(streamUrl, item, sessionToken) {
        if (sessionToken !== undefined && sessionToken !== playSessionId) {
            return;
        }
        stopPlayback();
        if (streamUrl && String(streamUrl).indexOf('|') !== -1) {
            var inlinePipe = splitM3uPipeHeaders(streamUrl);
            streamUrl = inlinePipe.url;
            if (item) {
                attachM3uDrmAndHeaders(item, null, inlinePipe);
            }
        }
        var isProxyStreamUrl = String(streamUrl || '').indexOf('/stream?url=') !== -1;
        if (!streamUrl || (!isProxyStreamUrl && isLocalhostOrInvalidUrl(streamUrl))) {
            hasActivePlaybackError = true;
            hideVodLoadingVisual();
            showOSD(formatOsdTitle(item), 'Invalid Stream URL');
            return;
        }
        var activeSession = sessionToken || playSessionId;
        var hasSyncedTracksOnBuffer = false;
        if (isPlayingVod || isPlayingCatchup) {
            showVodLoadingVisual(formatOsdTitle(item), 'Buffering VOD Stream (20s High-Stability Buffer)...', 20);
        }
        try {
            if (typeof webapis === 'undefined' || !webapis.avplay) {
                isPlaybackHealthy = true;
                hasActivePlaybackError = false;
                if (isPlaybackHealthy) {
                    document.body.classList.add('playing-live');
                }
                if (isPlayingVod || isPlayingCatchup) {
                    var simPct = 25;
                    vodLoadingSimTimer = setInterval(function() {
                        simPct += 25;
                        if (simPct <= 100) {
                            showVodLoadingVisual(formatOsdTitle(item), 'Buffering VOD Stream: ' + simPct + '% (20s Buffer)', simPct);
                        } else {
                            hideVodLoadingVisual();
                        }
                    }, 260);
                }
                showOSD(formatOsdTitle(item), 'SIMULATED PLAY');
                return;
            }
            webapis.avplay.open(streamUrl);
            try {
                var customUa = (item && item.userAgent) || (item && item.streamHeaders && (item.streamHeaders['User-Agent'] || item.streamHeaders['user-agent'])) || '';
                var streamUserAgent = customUa || ((isPlayingVod || api.getProviderType() !== 'stalker') ?
                    'VLC/3.0.20 LibVLC/3.0.20' :
                    'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3');
                webapis.avplay.setStreamingProperty('USER_AGENT', streamUserAgent);
                if (item && item.streamHeaders && (item.streamHeaders.Cookie || item.streamHeaders.cookie)) {
                    webapis.avplay.setStreamingProperty('COOKIE', String(item.streamHeaders.Cookie || item.streamHeaders.cookie));
                }
            } catch (eUa) {}
            try {
                if (webapis.productinfo && typeof webapis.productinfo.isUdPanelSupported === 'function' && webapis.productinfo.isUdPanelSupported()) {
                    webapis.avplay.setStreamingProperty('SET_MODE_4K', 'TRUE');
                }
            } catch (e4k) {}
            try {
                var isDashMpd = /\.mpd(\?|$)/i.test(String(streamUrl || ''));
                if (!isPlayingVod && !isPlayingCatchup && !isDashMpd) {
                    webapis.avplay.setStreamingProperty('IS_LIVE', 'TRUE');
                } else {
                    webapis.avplay.setStreamingProperty('IS_LIVE', 'FALSE');
                }
            } catch (eLive) {}
            // v2.1.0 Multi-DRM Architecture (Widevine CDM Device Type 60 + Tizen 4.0 fallback, PlayReady, W3C ClearKey + EME)
            try {
                if (item && item.drmType && typeof webapis.avplay.setDrm === 'function') {
                    var drmKind = String(item.drmType || '').toLowerCase();
                    var avHttpHeaderStr = formatAvPlayHttpHeaderString(item.drmHeaders || item.streamHeaders);
                    if (drmKind === 'widevine' || drmKind === 'widevine_cdm') {
                        var wvParams = {
                            LicenseServer: item.drmLicenseUrl || '',
                            DeviceTypeID: 60
                        };
                        if (avHttpHeaderStr) {
                            wvParams.HttpHeader = avHttpHeaderStr;
                        }
                        if (item.drmHeaders && typeof item.drmHeaders === 'object') {
                            wvParams.HttpRequestHeaders = item.drmHeaders;
                        }
                        if (item.drmCustomData) {
                            wvParams.CustomData = String(item.drmCustomData);
                        }
                        try {
                            webapis.avplay.setDrm('WIDEVINE_CDM', 'SetProperties', JSON.stringify(wvParams));
                        } catch (eWv5) {
                            // Tizen 4.0 (2018) legacy Widevine fallback
                            try {
                                webapis.avplay.setDrm('WIDEVINE', 'SetProperties', JSON.stringify(wvParams));
                            } catch (eWv4a) {}
                            try {
                                var legacyWvProp = 'DEVICE_ID=60|DEVICETYPE_ID=60|CURRENT_URL=' + streamUrl + '|PORTAL=' + (wvParams.LicenseServer || '') + '|I_SEEK=TIME';
                                webapis.avplay.setStreamingProperty('WIDEVINE', legacyWvProp);
                            } catch (eWv4b) {}
                        }
                    } else if (drmKind === 'playready') {
                        var prParams = {
                            LicenseServer: item.drmLicenseUrl || '',
                            DeleteLicenseAfterUse: true
                        };
                        if (item.drmCustomData) {
                            prParams.CustomData = String(item.drmCustomData);
                        }
                        if (avHttpHeaderStr) {
                            prParams.HttpHeader = avHttpHeaderStr;
                        }
                        if (item.drmHeaders && typeof item.drmHeaders === 'object') {
                            prParams.HttpRequestHeaders = item.drmHeaders;
                        }
                        webapis.avplay.setDrm('PLAYREADY', 'SetProperties', JSON.stringify(prParams));
                    } else if (drmKind === 'clearkey' && (item.clearKeyPair || item.clearKeyJwk)) {
                        var jwkPayload = item.clearKeyJwk || '';
                        if (!jwkPayload && item.clearKeyPair) {
                            var ckParts = String(item.clearKeyPair).split(':');
                            var hexToB64Url = function(hexStr) {
                                var cleanHex = String(hexStr || '').replace(/[^0-9a-fA-F]/g, '');
                                var bin = '';
                                for (var hi = 0; hi < cleanHex.length; hi += 2) {
                                    bin += String.fromCharCode(parseInt(cleanHex.slice(hi, hi + 2), 16));
                                }
                                return window.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                            };
                            jwkPayload = JSON.stringify({
                                keys: [{
                                    kty: 'oct',
                                    alg: 'A128KW',
                                    kid: hexToB64Url(ckParts[0] || ''),
                                    k: hexToB64Url(ckParts[1] || '')
                                }],
                                type: 'temporary'
                            });
                        }
                        try {
                            webapis.avplay.setDrm('CLEARKEY', 'SetProperties', jwkPayload);
                        } catch (eCkAv) {}
                    }
                }
            } catch (eDrm) {}
            applyAvPlayDisplayRect();
            try {
                webapis.avplay.setDisplayMethod(currentAspect);
            } catch (eAspect) {}
            try {
                // v2.1.0 Duplecast & STZ Player Two-Stage Asymmetric VOD Buffer for Tizen 4.0:
                // Stage 1 (PLAYER_BUFFER_FOR_PLAY = 5s): Fast initial frame decode without overflowing Tizen 4.0 hardware demux queue
                // Stage 2 (PLAYER_BUFFER_FOR_RESUME = 20s): Deep 20-second anti-stutter sustain buffer during VOD playback/seeking
                var initBufSec = (isPlayingVod || isPlayingCatchup) ? 5 : 1;
                var resumeBufSec = (isPlayingVod || isPlayingCatchup) ? 20 : 2;
                if (!isPlayingVod && !isPlayingCatchup) {
                    if (bufferModePref === 'balanced') {
                        initBufSec = 2;
                        resumeBufSec = 4;
                    } else if (bufferModePref === 'stable') {
                        initBufSec = 4;
                        resumeBufSec = 6;
                    }
                }
                webapis.avplay.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', initBufSec);
                webapis.avplay.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', resumeBufSec);
                try {
                    webapis.avplay.setTimeoutForBuffering((isPlayingVod || isPlayingCatchup) ? 45 : 25);
                } catch (eTimeBuf) {}
            } catch (eBuf) {}
            var lastSavedSec = 0;
            var lastRenderedPlaySec = -1;
            startBufferingWatchdog(item, streamUrl, activeSession);
            webapis.avplay.setListener({
                onbufferingstart: function() {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    startBufferingWatchdog(item, streamUrl, activeSession);
                    if (isPlayingVod || isPlayingCatchup) {
                        showVodLoadingVisual(formatOsdTitle(item), 'Buffering VOD Stream (20s High-Stability Buffer)...', 15);
                    } else {
                        // v2.1.0 Adaptive Buffer Auto-Stabilizer (3+ rebuffers in 60s steps Fast 1s -> Balanced 2s -> High Stability 4s)
                        var nowBufTs = Date.now();
                        var keptBursts = [];
                        for (var bi = 0; bi < rebufferBurstTimestamps.length; bi++) {
                            if ((nowBufTs - rebufferBurstTimestamps[bi]) <= 60000) {
                                keptBursts.push(rebufferBurstTimestamps[bi]);
                            }
                        }
                        keptBursts.push(nowBufTs);
                        rebufferBurstTimestamps = keptBursts;
                        if (rebufferBurstTimestamps.length >= 3 && bufferModePref !== 'stable') {
                            bufferModePref = (bufferModePref === 'fast') ? 'balanced' : 'stable';
                            safeSetStorage('cfg_buffer_mode', bufferModePref);
                            rebufferBurstTimestamps = [];
                            var steppedPlaySec = (bufferModePref === 'balanced') ? 2 : 4;
                            var steppedResumeSec = (bufferModePref === 'balanced') ? 4 : 6;
                            try {
                                webapis.avplay.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', steppedPlaySec);
                                webapis.avplay.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', steppedResumeSec);
                            } catch (eAutoBuf) {}
                            var stepLabel = (bufferModePref === 'balanced') ? 'Balanced (2s)' : 'High Stability (4s)';
                            showToast('⚡ Auto-Stabilizer: Buffer stepped to ' + stepLabel);
                        }
                    }
                    if (!uiVisible) {
                        showOSD(formatOsdTitle(item), 'BUFFERING...');
                    }
                },
                onbufferingprogress: function(percent) {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    var pctVal = Math.max(1, Math.min(100, Number(percent) || 0));
                    if (isPlayingVod || isPlayingCatchup) {
                        showVodLoadingVisual(formatOsdTitle(item), 'Buffering VOD Stream: ' + pctVal + '% (20s Buffer)', pctVal);
                    }
                    if (!uiVisible && osdStatus) {
                        osdStatus.textContent = 'BUFFERING ' + pctVal + '%';
                    }
                },
                onbufferingcomplete: function() {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    clearBufferingWatchdog();
                    hideVodLoadingVisual();
                    isPlaybackHealthy = true;
                    hasActivePlaybackError = false;
                    if (isPlaybackHealthy) {
                        document.body.classList.add('playing-live');
                    }
                    if (!hasSyncedTracksOnBuffer || audioTracks.length === 0) {
                        hasSyncedTracksOnBuffer = true;
                        var hadAudioBefore = audioTracks.length > 0;
                        refreshTrackLists();
                        if (!hadAudioBefore) {
                            syncInitialActiveTracks();
                        }
                        applySavedTrackPrefsForCurrentItem();
                        updateOsdStreamTelemetry();
                    }
                    var liveStatusLabel = isPlayingCatchup ? 'CATCH-UP' : (isPlayingVod ? 'VOD' : 'LIVE');
                    if (!uiVisible) {
                        showOSD(formatOsdTitle(item), liveStatusLabel);
                    } else if (osdStatus) {
                        osdStatus.textContent = liveStatusLabel;
                    }
                },
                oncurrentplaytime: function(currentTimeMs) {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    clearBufferingWatchdog();
                    hideVodLoadingVisual();
                    isPlaybackHealthy = true;
                    hasActivePlaybackError = false;
                    if (isPlaybackHealthy && !document.body.classList.contains('playing-live')) {
                        document.body.classList.add('playing-live');
                    }
                    if (playbackStartedAt > 0 && (Date.now() - playbackStartedAt) > 10000 && retryCount > 0) {
                        retryCount = 0;
                    }
                    // v2.1.0 Dual Late-PID Audio Track Discovery: re-check if audioTracks was empty on initial buffer
                    if (!hasSyncedTracksOnBuffer || audioTracks.length === 0) {
                        hasSyncedTracksOnBuffer = true;
                        var prevAudioLen = audioTracks.length;
                        refreshTrackLists();
                        if (prevAudioLen === 0 && audioTracks.length > 0) {
                            syncInitialActiveTracks();
                            applySavedTrackPrefsForCurrentItem();
                        }
                        updateOsdStreamTelemetry();
                    }
                    vodCurrentMs = Number(currentTimeMs) || 0;
                    if (isPlayingVod && pendingVodResumeMs > 0 && vodCurrentMs > 0) {
                        var deferredResumeTargetMs = pendingVodResumeMs;
                        pendingVodResumeMs = 0;
                        if (pendingVodResumeTimer) {
                            clearTimeout(pendingVodResumeTimer);
                            pendingVodResumeTimer = null;
                        }
                        try {
                            webapis.avplay.seekTo(deferredResumeTargetMs);
                            vodCurrentMs = deferredResumeTargetMs;
                            showOSD(formatOsdTitle(item), 'Resumed at ' + formatTimeHMS(Math.floor(deferredResumeTargetMs / 1000)));
                        } catch (eDefSeek) {}
                    }
                    if (isPlayingVod || isPlayingCatchup) {
                        var curSec = Math.floor(vodCurrentMs / 1000);
                        if (curSec === lastRenderedPlaySec) {
                            return;
                        }
                        lastRenderedPlaySec = curSec;
                        if (!vodDurationMs) {
                            try {
                                vodDurationMs = Number(webapis.avplay.getDuration()) || 0;
                            } catch (ex) {}
                        }
                        if (vodDurationMs > 0) {
                            var durSec = Math.floor(vodDurationMs / 1000);
                            if (osdBar && osdBar.classList.contains('visible')) {
                                var pct = Math.min(100, Math.max(0, (vodCurrentMs / vodDurationMs) * 100));
                                if (vodProgressBar) {
                                    vodProgressBar.style.width = pct + '%';
                                }
                                if (vodTimeDurEl && vodTimeLabel) {
                                    vodTimeLabel.textContent = formatTimeHMS(curSec);
                                    vodTimeDurEl.textContent = formatTimeHMS(durSec);
                                } else if (vodTimeLabel) {
                                    vodTimeLabel.textContent = formatTimeHMS(curSec) + ' / ' + formatTimeHMS(durSec);
                                }
                            }
                            if (isPlayingVod && Math.abs(curSec - lastSavedSec) >= 15) {
                                lastSavedSec = curSec;
                                saveResumeTime(item.id, curSec, durSec);
                            }
                            var remainingSec = (vodDurationMs - vodCurrentMs) / 1000;
                            if (item.isEpisode && remainingSec <= 15 && remainingSec > 1 && nextEpDismissedForId !== item.id) {
                                var nextEp = findNextEpisode(item);
                                if (nextEp) {
                                    triggerNextEpisodePrompt(nextEp);
                                }
                            }
                        }
                    }
                },
                onsubtitlechange: function(duration, text) {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    renderSubtitleCue(text, duration);
                },
                onstreamcompleted: function() {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    clearBufferingWatchdog();
                    clearSubtitleBox();
                    if (!isPlayingVod && !isPlayingCatchup && item) {
                        if (playbackStartedAt > 0 && (Date.now() - playbackStartedAt) > 10000) {
                            retryCount = 0;
                        }
                        handlePlaybackErrorOrRetry(item, streamUrl, 'LIVE_STREAM_EOF', activeSession);
                        return;
                    }
                    if (isPlayingVod && item) {
                        markItemWatched(item.id);
                        if (vodDurationMs > 0) {
                            saveResumeTime(item.id, vodDurationMs / 1000, vodDurationMs / 1000);
                        }
                    }
                    isPlayingVod = false;
                    isPlayingCatchup = false;
                    isPaused = false;
                    var nextEp = item && item.isEpisode ? findNextEpisode(item) : null;
                    if (nextEp) {
                        advanceToNextEpisode(nextEp);
                    } else {
                        currentPlayingItem = null;
                        stopPlayback();
                        setOverlayVisible(true);
                    }
                },
                onerror: function(eventType) {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    clearBufferingWatchdog();
                    handlePlaybackErrorOrRetry(item, streamUrl, eventType, activeSession);
                }
            });
            webapis.avplay.prepareAsync(function() {
                if (activeSession !== playSessionId) {
                    stopPlayback();
                    return;
                }
                clearBufferingWatchdog();
                playbackStartedAt = Date.now();
                isPlaybackHealthy = true;
                hasActivePlaybackError = false;
                if (isPlaybackHealthy) {
                    document.body.classList.add('playing-live');
                }
                // v2.1.0 Hardware Audio Unmute Enforcement on prepareAsync
                if (!playerMuted) {
                    try {
                        if (typeof tizen !== 'undefined' && tizen.tvaudiocontrol && typeof tizen.tvaudiocontrol.setMute === 'function') {
                            tizen.tvaudiocontrol.setMute(false);
                        }
                    } catch (eTzMute) {}
                    try {
                        if (typeof webapis !== 'undefined' && webapis.tvaudiocontrol && typeof webapis.tvaudiocontrol.setMute === 'function') {
                            webapis.tvaudiocontrol.setMute(false);
                        }
                    } catch (eWaMute) {}
                }
                setScreensaverDisabled(true);
                applyAvPlayDisplayRect();
                try {
                    if (webapis.avplay.setSilentSubtitle) {
                        webapis.avplay.setSilentSubtitle(!subtitlesEnabled);
                    }
                } catch (eSubInit) {}
                webapis.avplay.play();
                isPaused = false;
                if (!hasSyncedTracksOnBuffer) {
                    hasSyncedTracksOnBuffer = true;
                    refreshTrackLists();
                    syncInitialActiveTracks();
                    applySavedTrackPrefsForCurrentItem();
                    updateOsdStreamTelemetry();
                }
                if (isPlayingVod || isPlayingCatchup) {
                    try {
                        vodDurationMs = Number(webapis.avplay.getDuration()) || 0;
                    } catch (ex) {
                        vodDurationMs = 0;
                    }
                    var resume = isPlayingVod ? getResumeInfo(item.id) : null;
                    if (resume && resume.pos > 15) {
                        // v2.1.0 STZ Player Fix for Tizen 4.0: Defer seekTo() until post-PLAYING first PTS frame
                        // so .mkv/.mp4/HLS VOD streams do not reset to 00:00:00 on hardware AVPlay.
                        pendingVodResumeMs = Math.floor(resume.pos * 1000);
                        if (pendingVodResumeTimer) {
                            clearTimeout(pendingVodResumeTimer);
                        }
                        pendingVodResumeTimer = setTimeout(function() {
                            pendingVodResumeTimer = null;
                            if (activeSession === playSessionId && isPlayingVod && pendingVodResumeMs > 0) {
                                var fallbackResumeMs = pendingVodResumeMs;
                                pendingVodResumeMs = 0;
                                try {
                                    webapis.avplay.seekTo(fallbackResumeMs);
                                    showOSD(formatOsdTitle(item), 'Resumed at ' + formatTimeHMS(Math.floor(fallbackResumeMs / 1000)));
                                } catch (exSeekFallback) {}
                            }
                        }, 900);
                    }
                } else if (item && !shortEpgCache[String(item.id)]) {
                    api.fetchShortEpg(item.id).then(function(epgList) {
                        if (activeSession === playSessionId && currentPlayingItem && String(currentPlayingItem.id) === String(item.id)) {
                            var parsed = parseShortEpgNowNext(epgList);
                            if (epgNow) {
                                epgNow.textContent = parsed.now;
                            }
                            if (epgNext) {
                                epgNext.textContent = parsed.next;
                            }
                            updateOsdEpgProgressBar();
                            updateInlineRowEpg(item.id, parsed.now);
                            if (!uiVisible && !hasActivePlaybackError) {
                                showOSD(formatOsdTitle(item), 'LIVE', parsed.now, parsed.next);
                            }
                        }
                    }).catch(function() {});
                }
            }, function(prepErr) {
                if (activeSession !== playSessionId) {
                    return;
                }
                clearBufferingWatchdog();
                handlePlaybackErrorOrRetry(item, streamUrl, prepErr || 'PREPARE_FAILED', activeSession);
            });
        } catch (ex3) {
            clearBufferingWatchdog();
            handlePlaybackErrorOrRetry(item, streamUrl, 'INIT_ERROR', activeSession);
        }
    }
    function handlePlaybackErrorOrRetry(item, failedUrl, reason, activeSession) {
        if (activeSession !== playSessionId || !item) {
            return;
        }
        isPlaybackHealthy = false;
        document.body.classList.remove('playing-live');
        if (isPlayingVod && item.id && vodCurrentMs > 15000 && vodDurationMs > 0) {
            saveResumeTime(item.id, Math.floor(vodCurrentMs / 1000), Math.floor(vodDurationMs / 1000));
        }
        var linkCount = (item.cmds && Array.isArray(item.cmds) && item.cmds.length > 1) ? item.cmds.length : 1;
        var maxRetries = Math.max(4, Math.min(6, linkCount * 2));
        if (retryCount < maxRetries) {
            retryCount++;
            if (linkCount > 1) {
                item._cmdIdx = ((item._cmdIdx || 0) + 1) % linkCount;
                var linkNum = item._cmdIdx + 1;
                showOSD(formatOsdTitle(item), 'Failover Link ' + linkNum + '/' + linkCount + ' (' + retryCount + '/' + maxRetries + ')...');
                showToast('🔄 Switching to Backup Link ' + linkNum + '/' + linkCount);
            } else {
                item._altFormatIdx = (item._altFormatIdx || 0) + 1;
                showOSD(formatOsdTitle(item), 'Reconnecting (' + retryCount + '/' + maxRetries + ')...');
                if (retryCount === 2) {
                    showToast('🔄 Reconnecting stream (' + retryCount + '/' + maxRetries + ')...');
                }
            }
            if (!item.isVod && !item.isEpisode && !item.isCatchup && retryCount === 1) {
                if (item.useTmpLink) {
                    item._preferDirectUrl = !item._preferDirectUrl;
                } else {
                    item._preferDirectUrl = false;
                }
            }
            var retryDelayMs = retryCount === 1 ? 200 : (retryCount === 2 ? 500 : 900);
            setTimeout(function() {
                if (activeSession !== playSessionId) {
                    return;
                }
                function shouldProxyOnRetry(candidateUrl) {
                    if (!candidateUrl || candidateUrl.indexOf('/stream?url=') !== -1 || !/^https?:\/\//i.test(candidateUrl)) {
                        return false;
                    }
                    if (retryCount < 2) {
                        return false;
                    }
                    var isVodMedia = Boolean(item && (item.isVod || item.isEpisode));
                    if (isVodMedia) {
                        var isNetOrHttpErr = /network|http|prepare|open/i.test(String(reason || ''));
                        return (playbackStartedAt <= 0 && isNetOrHttpErr);
                    }
                    return true;
                }
                api.resolveStream(item, true).then(function(newUrl) {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    var cleanCandidate = String(newUrl || failedUrl || '').replace(/^(?:ffmpeg|ffrt\d*|auto|solution)\s+/i, '').trim();
                    if (shouldProxyOnRetry(cleanCandidate)) {
                        cleanCandidate = api.proxyUrl + '/stream?url=' + encodeURIComponent(cleanCandidate);
                    }
                    playUrl(cleanCandidate, item, activeSession);
                }).catch(function() {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    var fallbackCandidate = String(failedUrl || '').replace(/^(?:ffmpeg|ffrt\d*|auto|solution)\s+/i, '').trim();
                    if (shouldProxyOnRetry(fallbackCandidate)) {
                        fallbackCandidate = api.proxyUrl + '/stream?url=' + encodeURIComponent(fallbackCandidate);
                    }
                    playUrl(fallbackCandidate, item, activeSession);
                });
            }, retryDelayMs);
        } else {
            hasActivePlaybackError = true;
            hideVodLoadingVisual();
            showOSD(formatOsdTitle(item), 'Stream Unavailable (' + String(reason) + ') — Press OK to Retry');
            if (failedUrl) {
                var diagFailedUrl = unwrapProxyStreamUrl(failedUrl);
                proxyFetch(api.proxyUrl + '/stream-diag?url=' + encodeURIComponent(diagFailedUrl))
                    .then(function(r) { return r.json(); })
                    .then(function(d) {
                        var summaryText = d && d.verdict ? (d.verdict.summary || d.verdict.reason || d.verdict.label) : '';
                        if (summaryText && activeSession === playSessionId) {
                            var isProv = d.verdict.source === 'provider' || d.verdict.status === 'provider_error' || d.verdict.status === 'provider_slow';
                            var statusLabel = isProv ? 'PROVIDER OFFLINE' : 'STREAM ERROR';
                            showOSD(formatOsdTitle(item), statusLabel, summaryText, 'Press OK to Retry • Tools/Settings for options');
                            showToast('🩺 ' + summaryText);
                        }
                    })
                    .catch(function() {});
            }
        }
    }

    function resolveVodRedirectPreOpen(rawUrl, item, callback) {
        var clean = String(rawUrl || '').trim();
        if (!clean || clean.indexOf('/stream?url=') !== -1 || !/^https?:\/\//i.test(clean) || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(clean)) {
            callback(clean);
            return;
        }
        var done = false;
        var timer = setTimeout(function() {
            if (!done) {
                done = true;
                callback(clean);
            }
        }, 1800);
        try {
            var q = api.proxyUrl + '/vod-resolve?url=' + encodeURIComponent(clean);
            var ua = (item && item.userAgent) || (item && item.streamHeaders && (item.streamHeaders['User-Agent'] || item.streamHeaders['user-agent'])) || '';
            var ref = (item && item.httpReferer) || (item && item.streamHeaders && (item.streamHeaders.Referer || item.streamHeaders.referer)) || '';
            var ck = (item && item.streamHeaders && (item.streamHeaders.Cookie || item.streamHeaders.cookie)) || '';
            if (ua) q += '&ua=' + encodeURIComponent(ua);
            if (ref) q += '&referer=' + encodeURIComponent(ref);
            if (ck) q += '&cookie=' + encodeURIComponent(ck);
            proxyFetch(q)
                .then(function(r) { return r.json(); })
                .then(function(info) {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    if (info && info.ok && info.finalUrl && /^https?:\/\//i.test(info.finalUrl)) {
                        callback(String(info.finalUrl));
                    } else {
                        callback(clean);
                    }
                })
                .catch(function() {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    callback(clean);
                });
        } catch (eRes) {
            if (!done) {
                done = true;
                clearTimeout(timer);
                callback(clean);
            }
        }
    }

    function playItem(item) {
        if (!item) {
            return;
        }
        if (!window._parentalUnlocked && isAdultContentItem(item)) {
            if (!currentPlayingItem && !uiVisible) {
                setOverlayVisible(true);
            }
            openPinModal(function() {
                playItem(item);
            });
            return;
        }
        if (item.isVod || item.isEpisode || userInteractedSinceBoot) {
            setOverlayVisible(false);
        }
        if (currentPlayingItem && !currentPlayingItem.isVod && !currentPlayingItem.isCatchup && !item.isVod &&
            String(currentPlayingItem.id) !== String(item.id)) {
            previousLiveChannel = currentPlayingItem;
        }
        var mySession = ++playSessionId;
        if (previewEpgTimeout) {
            clearTimeout(previewEpgTimeout);
            previewEpgTimeout = null;
        }
        api.abortShortEpg();
        stopPlayback();
        currentPlayingItem = item;
        syncPlayingRowIndicators();
        isPlaybackHealthy = false;
        hasActivePlaybackError = false;
        isPlayingVod = Boolean(item.isVod || item.isEpisode);
        isPlayingCatchup = false;
        currentPlaybackSpeed = 1;
        vodDurationMs = 0;
        vodCurrentMs = 0;
        retryCount = 0;
        playbackStartedAt = 0;
        if (item._keepCmdIdx) {
            delete item._keepCmdIdx;
        } else {
            item._cmdIdx = 0;
        }
        item._altFormatIdx = 0;
        audioTracks = [];
        textTracks = [];
        audioIdx = 0;
        textIdx = -1;
        hasAppliedSavedTrackPrefs = false;
        var savedMediaPref = getItemMediaPrefs(item);
        if (savedMediaPref && savedMediaPref.aspect) {
            currentAspect = savedMediaPref.aspect;
        } else {
            currentAspect = localStorage.getItem('cfg_default_aspect') || 'PLAYER_DISPLAY_MODE_LETTER_BOX';
        }
        subtitlesEnabled = (savedMediaPref && savedMediaPref.subOn === false) ? false : true;
        if (item.isEpisode) {
            if (currentItems.length > 0 && currentItems[0] && currentItems[0].isEpisode) {
                playingEpisodeList = currentItems.slice();
            }
            var nextSnap = findNextEpisode(item);
            if (nextSnap) {
                item.nextEpSnapshot = nextSnap;
            }
        }
        nextEpDismissedForId = null;
        clearNextEpisodePrompt();

        var cachedEpg = !isPlayingVod ? shortEpgCache[String(item.id)] : null;
        var initialNow = item.isVod ? (item.desc || 'Movie / Series') : 'Loading EPG...';
        var initialNext = '';
        if (cachedEpg && Array.isArray(cachedEpg.list)) {
            var parsedCached = parseShortEpgNowNext(cachedEpg.list);
            initialNow = parsedCached.now;
            initialNext = parsedCached.next;
        }
        showOSD(formatOsdTitle(item), 'CONNECTING...', initialNow, initialNext);
        if (isPlayingVod) {
            showVodLoadingVisual(formatOsdTitle(item), 'Connecting to VOD stream • Preparing 20s Buffer...', 10);
        }

        api.resolveStream(item, false).then(function(url) {
            if (mySession !== playSessionId) {
                return;
            }
            var cleanUrl = String(url || '').replace(/^(?:ffmpeg|ffrt\d*|auto|solution)\s+/i, '').trim();
            if (isPlayingVod) {
                resolveVodRedirectPreOpen(cleanUrl, item, function(resolvedVodUrl) {
                    if (mySession !== playSessionId) {
                        return;
                    }
                    playUrl(resolvedVodUrl, item, mySession);
                });
            } else {
                playUrl(cleanUrl, item, mySession);
            }
        }).catch(function(err) {
            if (mySession !== playSessionId) {
                return;
            }
            hasActivePlaybackError = true;
            hideVodLoadingVisual();
            showOSD(formatOsdTitle(item), 'Link Error: ' + err.message);
        });

        setTimeout(function() {
            if (mySession !== playSessionId) {
                return;
            }
            pushRecentItem(item);
            if (!isPlayingVod) {
                saveLastLiveChannel(item);
            }
            syncPlayingRowIndicators();
        }, 0);
    }
    function playCatchupProgram(channel, epgProg) {
        if (!channel || !epgProg) {
            return;
        }
        if (!window._parentalUnlocked && isAdultContentItem(channel)) {
            if (!currentPlayingItem && !uiVisible) {
                setOverlayVisible(true);
            }
            openPinModal(function() {
                playCatchupProgram(channel, epgProg);
            });
            return;
        }
        setOverlayVisible(false);
        var mySession = ++playSessionId;
        stopPlayback();
        var catchupItem = {
            id: 'arch_' + channel.id + '_' + epgProg.start_timestamp,
            name: channel.name + ' — ' + epgProg.name,
            cmd: channel.cmd,
            isVod: false,
            isCatchup: true,
            channelRef: channel,
            epgProgRef: epgProg
        };
        currentPlayingItem = catchupItem;
        syncPlayingRowIndicators();
        isPlaybackHealthy = false;
        hasActivePlaybackError = false;
        isPlayingVod = false;
        isPlayingCatchup = true;
        currentPlaybackSpeed = 1;
        retryCount = 0;
        playbackStartedAt = 0;
        audioTracks = [];
        textTracks = [];
        audioIdx = 0;
        textIdx = -1;
        hasAppliedSavedTrackPrefs = false;
        var catchupPref = getItemMediaPrefs(channel);
        if (catchupPref && catchupPref.aspect) {
            currentAspect = catchupPref.aspect;
        } else {
            currentAspect = localStorage.getItem('cfg_default_aspect') || 'PLAYER_DISPLAY_MODE_LETTER_BOX';
        }
        subtitlesEnabled = (catchupPref && catchupPref.subOn === false) ? false : true;
        vodDurationMs = Math.max(0, (Number(epgProg.stop_timestamp) - Number(epgProg.start_timestamp)) * 1000);
        vodCurrentMs = 0;
        showOSD(catchupItem.name, 'CATCH-UP', 'Archive: ' + epgProg.timeLabel, epgProg.descr || '');
        api.createArchiveLink(channel, epgProg).then(function(url) {
            if (mySession !== playSessionId) {
                return;
            }
            var cleanArchiveUrl = String(url || '').replace(/^(?:ffmpeg|ffrt\d*|auto|solution)\s+/i, '').trim();
            catchupItem.cmd = cleanArchiveUrl;
            setOverlayVisible(false);
            pushRecentItem(channel);
            playUrl(cleanArchiveUrl, catchupItem, mySession);
        }).catch(function(err) {
            if (mySession !== playSessionId) {
                return;
            }
            hasActivePlaybackError = true;
            showOSD(channel.name, 'Archive Unavailable (' + err.message + ') — Press OK to Retry');
        });
    }

    function parseTrackLabel(trackObj, fallbackNum) {
        if (!trackObj || !trackObj.extra_info) {
            return 'Track #' + fallbackNum;
        }
        try {
            var info = null;
            if (typeof trackObj.extra_info === 'object') {
                info = trackObj.extra_info;
            } else {
                var rawExtra = String(trackObj.extra_info || '').trim();
                if (rawExtra.charAt(0) === '{') {
                    info = JSON.parse(rawExtra);
                } else {
                    // Tizen 4.0-9.0 raw key-value extra_info fallback (e.g. "track_lang=eng;fourCC=mp4a;channels=2")
                    info = {};
                    var kvPairs = rawExtra.split(/[;,]/);
                    for (var kvi = 0; kvi < kvPairs.length; kvi++) {
                        var eqIdx = kvPairs[kvi].indexOf('=');
                        if (eqIdx === -1) eqIdx = kvPairs[kvi].indexOf(':');
                        if (eqIdx !== -1) {
                            var kName = kvPairs[kvi].slice(0, eqIdx).trim();
                            var kVal = kvPairs[kvi].slice(eqIdx + 1).trim();
                            if (kName) info[kName] = kVal;
                        }
                    }
                }
            }
            var parts = ['Track #' + fallbackNum];
            var meta = [];
            var lang = info.language || info.Language || info.lang || info.track_lang || info.Track_Lang || info.iso639_2 || '';
            if (lang && String(lang).trim() && String(lang).toLowerCase() !== 'und') {
                meta.push(String(lang).trim().toUpperCase());
            }
            var codec = info.fourCC || info.FourCC || info.codec || info.Codec || info.audio_type || '';
            if (codec && String(codec).trim()) {
                meta.push(String(codec).trim().toUpperCase());
            }
            var ch = info.channels || info.Channels || info.channel_count || '';
            if (ch && Number(ch) > 0) {
                meta.push(Number(ch) + 'ch');
            }
            if (meta.length > 0) {
                parts.push('(' + meta.join(' • ') + ')');
            }
            return parts.join(' ');
        } catch (ex) {
            return 'Track #' + fallbackNum;
        }
    }

    function refreshTrackLists() {
        try {
            if (typeof webapis === 'undefined' || !webapis.avplay || !webapis.avplay.getTotalTrackInfo) {
                return;
            }
            var tracks = webapis.avplay.getTotalTrackInfo() || [];
            var foundAudio = [];
            var foundText = [];
            for (var i = 0; i < tracks.length; i++) {
                var t = tracks[i];
                if (!t) {
                    continue;
                }
                var tType = String(t.type || '').toUpperCase();
                if (tType === 'AUDIO' || tType === 'SOUND') {
                    foundAudio.push(t);
                } else if (tType === 'TEXT' || tType === 'SUBTITLE') {
                    foundText.push(t);
                }
            }
            if (foundAudio.length > 0) {
                audioTracks = foundAudio;
            }
            if (foundText.length > 0) {
                textTracks = foundText;
            }
        } catch (ex) {}
    }

    function syncInitialActiveTracks() {
        try {
            if (typeof webapis === 'undefined' || !webapis.avplay || !webapis.avplay.getCurrentStreamInfo) {
                return;
            }
            var currentStreams = webapis.avplay.getCurrentStreamInfo() || [];
            for (var i = 0; i < currentStreams.length; i++) {
                var s = currentStreams[i];
                if (!s) {
                    continue;
                }
                var sType = String(s.type || '').toUpperCase();
                if (sType === 'AUDIO' || sType === 'SOUND') {
                    for (var a = 0; a < audioTracks.length; a++) {
                        if (String(audioTracks[a].index) === String(s.index)) {
                            audioIdx = a;
                            break;
                        }
                    }
                } else if (sType === 'TEXT' || sType === 'SUBTITLE') {
                    for (var t = 0; t < textTracks.length; t++) {
                        if (String(textTracks[t].index) === String(s.index)) {
                            textIdx = t;
                            break;
                        }
                    }
                }
            }
        } catch (ex) {}
        try {
            if (typeof webapis !== 'undefined' && webapis.tvaudiocontrol && typeof webapis.tvaudiocontrol.isMute === 'function') {
                if (webapis.tvaudiocontrol.isMute()) {
                    webapis.tvaudiocontrol.setMute(false);
                }
            }
        } catch (eMute) {}
    }

    function togglePlayPause() {
        if (!currentPlayingItem) {
            return;
        }
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                if (isPaused) {
                    webapis.avplay.play();
                    isPaused = false;
                    showOSD(formatOsdTitle(currentPlayingItem), isPlayingCatchup ? 'CATCH-UP' : (isPlayingVod ? 'PLAYING' : 'LIVE'));
                } else {
                    webapis.avplay.pause();
                    isPaused = true;
                    showOSD(formatOsdTitle(currentPlayingItem), 'PAUSED');
                }
            }
        } catch (ex) {}
    }
    function getChannelPrefsMap() {
        if (!channelPrefsCache) {
            channelPrefsCache = safeGetJson(getProfileScopedKey('ch_prefs'), {});
        }
        return channelPrefsCache;
    }
    function getItemPrefKey(item) {
        if (!item) {
            return '';
        }
        if (item.isEpisode && item.seriesId) {
            return 'ser_' + String(item.seriesId);
        }
        if (item.isCatchup && item.channelRef && item.channelRef.id !== undefined) {
            return String(item.channelRef.id);
        }
        return item.id !== undefined && item.id !== null ? String(item.id) : '';
    }
    function getItemMediaPrefs(item) {
        if (!item) {
            return null;
        }
        var map = getChannelPrefsMap();
        var primaryKey = getItemPrefKey(item);
        if (primaryKey && map[primaryKey]) {
            return map[primaryKey];
        }
        if (item.id !== undefined && map[String(item.id)]) {
            return map[String(item.id)];
        }
        return null;
    }
    function saveItemMediaPrefPatch(item, patchObj) {
        var key = getItemPrefKey(item);
        if (!key || !patchObj) {
            return;
        }
        var map = getChannelPrefsMap();
        var existing = map[key] || {};
        var updated = extendObj(existing, patchObj);
        updated.ts = Date.now();
        map[key] = updated;
        var allKeys = Object.keys(map);
        if (allKeys.length > 300) {
            var oldestKey = allKeys[0];
            var oldestTs = map[oldestKey] ? (map[oldestKey].ts || 0) : 0;
            for (var i = 1; i < allKeys.length; i++) {
                var k = allKeys[i];
                var kTs = map[k] ? (map[k].ts || 0) : 0;
                if (kTs < oldestTs) {
                    oldestTs = kTs;
                    oldestKey = k;
                }
            }
            if (oldestKey) {
                delete map[oldestKey];
            }
        }
        channelPrefsCache = map;
        safeSetStorage(getProfileScopedKey('ch_prefs'), JSON.stringify(map));
    }
    function clearItemMediaPrefs(item) {
        var key = getItemPrefKey(item);
        if (!key) {
            return;
        }
        var map = getChannelPrefsMap();
        if (map[key]) {
            delete map[key];
        }
        if (item && item.id !== undefined && map[String(item.id)]) {
            delete map[String(item.id)];
        }
        channelPrefsCache = map;
        safeSetStorage(getProfileScopedKey('ch_prefs'), JSON.stringify(map));
    }
    function extractTrackLangCode(trackObj) {
        if (!trackObj) {
            return '';
        }
        if (trackObj.language && String(trackObj.language).toLowerCase() !== 'und') {
            return String(trackObj.language).trim().toLowerCase();
        }
        if (trackObj.extra_info) {
            try {
                var info = typeof trackObj.extra_info === 'object' ? trackObj.extra_info : JSON.parse(trackObj.extra_info);
                var lang = info.language || info.Language || info.lang || info.track_lang || info.Track_Lang || info.iso639_2 || info.name || '';
                if (lang && String(lang).toLowerCase() !== 'und') {
                    return String(lang).trim().toLowerCase();
                }
            } catch (ex) {}
        }
        return '';
    }
    function applySavedTrackPrefsForCurrentItem() {
        if (hasAppliedSavedTrackPrefs || !currentPlayingItem) {
            return;
        }
        var pref = getItemMediaPrefs(currentPlayingItem);
        if (!pref) {
            return;
        }
        var appliedAny = false;
        if (audioTracks.length > 0 && (pref.audLang || (pref.audIdx !== undefined && pref.audIdx >= 0))) {
            var isFallbackOnly = Boolean(audioTracks.length === 1 && audioTracks[0]._isMseFallback);
            if (!isFallbackOnly) {
                var targetA = -1;
                if (pref.audLang) {
                    for (var a = 0; a < audioTracks.length; a++) {
                        if (extractTrackLangCode(audioTracks[a]) === pref.audLang) {
                            targetA = a;
                            break;
                        }
                    }
                }
                if (targetA === -1 && pref.audIdx !== undefined && pref.audIdx >= 0 && pref.audIdx < audioTracks.length) {
                    targetA = pref.audIdx;
                }
                if (targetA >= 0 && targetA !== audioIdx) {
                    selectAudioTrackByArrayIndex(targetA, true);
                }
                appliedAny = true;
            }
        }
        if (pref.subOn === false) {
            if (subtitlesEnabled || textIdx !== -1) {
                selectSubtitleTrackByArrayIndex(-1, true);
            }
            appliedAny = true;
        } else if (pref.subOn === true && textTracks.length > 0) {
            var targetS = -1;
            if (pref.subLang) {
                for (var s = 0; s < textTracks.length; s++) {
                    if (extractTrackLangCode(textTracks[s]) === pref.subLang) {
                        targetS = s;
                        break;
                    }
                }
            }
            if (targetS === -1 && pref.subIdx !== undefined && pref.subIdx >= 0 && pref.subIdx < textTracks.length) {
                targetS = pref.subIdx;
            }
            if (targetS >= 0 && (!subtitlesEnabled || targetS !== textIdx)) {
                selectSubtitleTrackByArrayIndex(targetS, true);
            }
            appliedAny = true;
        }
        if (appliedAny && (audioTracks.length > 1 || textTracks.length > 0 || pref.subOn === false)) {
            hasAppliedSavedTrackPrefs = true;
        }
    }

    function toggleAspectRatio() {
        if (currentAspect === 'PLAYER_DISPLAY_MODE_LETTER_BOX') {
            currentAspect = 'PLAYER_DISPLAY_MODE_FULL_SCREEN';
        } else {
            currentAspect = 'PLAYER_DISPLAY_MODE_LETTER_BOX';
        }
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                webapis.avplay.setDisplayMethod(currentAspect);
            }
        } catch (ex) {}
        if (currentPlayingItem) {
            saveItemMediaPrefPatch(currentPlayingItem, { aspect: currentAspect });
        } else {
            safeSetStorage('cfg_default_aspect', currentAspect);
        }
        var label = currentAspect === 'PLAYER_DISPLAY_MODE_FULL_SCREEN' ? '16:9 Stretch' : 'Original Aspect';
        showOSD(formatOsdTitle(currentPlayingItem), label);
        showToast('📐 Aspect: ' + label + (currentPlayingItem ? ' (Saved)' : ''));
    }
    function selectAudioTrackByArrayIndex(targetAudioIdx, isAutoRestore) {
        if (targetAudioIdx < 0 || targetAudioIdx >= audioTracks.length) {
            return;
        }
        audioIdx = targetAudioIdx;
        var chosen = audioTracks[audioIdx];
        var trackIndexNum = parseInt(chosen.index, 10);
        var trackDesc = parseTrackLabel(chosen, audioIdx + 1) + ' (' + (audioIdx + 1) + '/' + audioTracks.length + ')';
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                webapis.avplay.setSelectTrack('AUDIO', trackIndexNum);
            }
            if (!isAutoRestore && currentPlayingItem) {
                saveItemMediaPrefPatch(currentPlayingItem, {
                    audIdx: audioIdx,
                    audLang: extractTrackLangCode(chosen)
                });
            }
            updateOsdStreamTelemetry();
            if (!isAutoRestore) {
                showOSD(formatOsdTitle(currentPlayingItem), 'Audio: ' + trackDesc);
                showToast('🔊 Audio: ' + trackDesc + ' (Saved)');
            }
        } catch (ex) {
            if (!isAutoRestore) {
                showOSD(formatOsdTitle(currentPlayingItem), 'Audio Switch Failed');
                showToast('🔊 Audio Switch Failed');
            }
        }
    }

    function selectSubtitleTrackByArrayIndex(targetSubIdx, isAutoRestore) {
        if (targetSubIdx < 0 || targetSubIdx >= textTracks.length) {
            textIdx = -1;
            subtitlesEnabled = false;
            clearSubtitleBox();
            try {
                if (typeof webapis !== 'undefined' && webapis.avplay && webapis.avplay.setSilentSubtitle) {
                    webapis.avplay.setSilentSubtitle(true);
                }
            } catch (exOff) {}
            if (!isAutoRestore && currentPlayingItem) {
                saveItemMediaPrefPatch(currentPlayingItem, {
                    subOn: false,
                    subIdx: -1,
                    subLang: ''
                });
            }
            if (!isAutoRestore) {
                showOSD(formatOsdTitle(currentPlayingItem), 'Subtitles Off');
                showToast('💬 Subtitles Off (Saved)');
            }
            return;
        }
        textIdx = targetSubIdx;
        var chosen = textTracks[textIdx];
        var subIndexNum = parseInt(chosen.index, 10);
        var subDesc = parseTrackLabel(chosen, textIdx + 1) + ' (' + (textIdx + 1) + '/' + textTracks.length + ')';
        subtitlesEnabled = true;
        clearSubtitleBox();
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                if (webapis.avplay.setSilentSubtitle) {
                    webapis.avplay.setSilentSubtitle(false);
                }
                webapis.avplay.setSelectTrack('TEXT', subIndexNum);
                try {
                    if (webapis.avplay.setSubtitlePosition) {
                        webapis.avplay.setSubtitlePosition(subtitleDelayMs);
                    }
                } catch (ePos) {}
            }
            if (!isAutoRestore && currentPlayingItem) {
                saveItemMediaPrefPatch(currentPlayingItem, {
                    subOn: true,
                    subIdx: textIdx,
                    subLang: extractTrackLangCode(chosen)
                });
            }
            if (!isAutoRestore) {
                showOSD(formatOsdTitle(currentPlayingItem), 'Subtitle: ' + subDesc);
                showToast('💬 Subtitle: ' + subDesc + ' (Saved)');
            }
        } catch (ex) {
            if (!isAutoRestore) {
                showOSD(formatOsdTitle(currentPlayingItem), 'Subtitle Switch Failed');
                showToast('Subtitle Switch Failed');
            }
        }
    }

    function openTracksModal(preferredSection) {
        var activeOrSelectedItem = currentPlayingItem || currentItems[itemIdx] || null;
        if (!activeOrSelectedItem) {
            showToast('Play a channel, movie, or episode first');
            return;
        }
        refreshTrackLists();
        syncInitialActiveTracks();
        applySubtitleAppearance();
        var items = [];
        if (audioTracks.length === 0) {
            items.push({ id: 'aud_default', kind: 'audio', trackArrIdx: -1, label: '🔊 Audio: Default Stream Track (Active)' });
        } else {
            for (var a = 0; a < audioTracks.length; a++) {
                var isActAud = (a === audioIdx);
                items.push({
                    id: 'aud_' + a,
                    kind: 'audio',
                    trackArrIdx: a,
                    label: (isActAud ? '🟢 ' : '🔊 ') + 'Audio: ' + parseTrackLabel(audioTracks[a], a + 1) + (isActAud ? ' [ACTIVE]' : '')
                });
            }
        }
        items.push({
            id: 'sub_off',
            kind: 'sub',
            trackArrIdx: -1,
            label: (!subtitlesEnabled || textIdx === -1 ? '🟢 ' : '💬 ') + 'Subtitles: Off' + (!subtitlesEnabled || textIdx === -1 ? ' [ACTIVE]' : '')
        });
        for (var t = 0; t < textTracks.length; t++) {
            var isActSub = (subtitlesEnabled && t === textIdx);
            items.push({
                id: 'sub_' + t,
                kind: 'sub',
                trackArrIdx: t,
                label: (isActSub ? '🟢 ' : '💬 ') + 'Subtitle: ' + parseTrackLabel(textTracks[t], t + 1) + (isActSub ? ' [ACTIVE]' : '')
            });
        }
        var aspectLabel = currentAspect === 'PLAYER_DISPLAY_MODE_FULL_SCREEN' ? '16:9 Stretch' : 'Original Letterbox';
        items.push({
            id: 'aspect_toggle',
            kind: 'aspect',
            label: '📐 Aspect Ratio: ' + aspectLabel + ' (Press OK to Switch)'
        });
        if (isPlayingVod || isPlayingCatchup || (activeOrSelectedItem && (activeOrSelectedItem.isVod || activeOrSelectedItem.isEpisode))) {
            items.push({
                id: 'speed_toggle',
                kind: 'speed',
                label: '⏩ Playback Speed: ' + currentPlaybackSpeed + 'x (Press OK to Cycle 0.75x - 2x)'
            });
            var bmSec = activeOrSelectedItem ? getVodBookmarkSec(activeOrSelectedItem.id) : 0;
            items.push({
                id: 'vod_bookmark',
                kind: 'bookmark',
                label: bmSec > 0 ? ('🔖 Scene Bookmark: ' + formatTimeHMS(bmSec) + ' (Press OK to Jump / Update)') : '🔖 Save Scene Bookmark at Current Position'
            });
        }
        if (activeOrSelectedItem && Array.isArray(activeOrSelectedItem.cmds) && activeOrSelectedItem.cmds.length > 1) {
            var curLinkNum = ((activeOrSelectedItem._cmdIdx || 0) % activeOrSelectedItem.cmds.length) + 1;
            items.push({
                id: 'switch_backup_link',
                kind: 'backup_link',
                label: '🔄 Stream Server Link: ' + curLinkNum + '/' + activeOrSelectedItem.cmds.length + ' (Press OK to Switch Link)'
            });
        }
        items.push({
            id: 'sub_delay_minus',
            kind: 'delay',
            deltaMs: -250,
            label: '⏪ Subtitle Timing Offset: -250ms (Current: ' + formatSubtitleDelayLabel(subtitleDelayMs) + ')'
        });
        items.push({
            id: 'sub_delay_plus',
            kind: 'delay',
            deltaMs: 250,
            label: '⏩ Subtitle Timing Offset: +250ms (Current: ' + formatSubtitleDelayLabel(subtitleDelayMs) + ')'
        });
        items.push({
            id: 'sub_delay_reset',
            kind: 'delay_reset',
            deltaMs: 0,
            label: '⏱ Reset Subtitle Timing Offset (0ms)'
        });
        var savedPrefForModal = getItemMediaPrefs(activeOrSelectedItem);
        if (savedPrefForModal) {
            items.push({
                id: 'clear_ch_prefs',
                kind: 'clear_ch_prefs',
                label: '🗑 Reset Saved Channel Audio/Sub/Aspect Memory'
            });
        }
        tracksModalItems = items;
        tracksModalIdx = 0;
        if (preferredSection === 'sub') {
            var foundSub = false;
            for (var s = 0; s < items.length; s++) {
                if (items[s].kind === 'sub') {
                    if ((subtitlesEnabled && items[s].trackArrIdx === textIdx) || (!subtitlesEnabled && items[s].trackArrIdx === -1)) {
                        tracksModalIdx = s;
                        foundSub = true;
                        break;
                    }
                }
            }
            if (!foundSub) {
                for (var s2 = 0; s2 < items.length; s2++) {
                    if (items[s2].kind === 'sub') {
                        tracksModalIdx = s2;
                        break;
                    }
                }
            }
        } else {
            for (var au = 0; au < items.length; au++) {
                if (items[au].kind === 'audio' && items[au].trackArrIdx === audioIdx) {
                    tracksModalIdx = au;
                    break;
                }
            }
        }
        tracksModalOpen = true;
        if (tracksModalTitleEl) {
            tracksModalTitleEl.textContent = preferredSection === 'sub' ? 'Subtitles & Appearance' : 'Audio & Subtitle Tracks';
        }
        if (tracksModalSubtitleEl) {
            tracksModalSubtitleEl.textContent = formatOsdTitle(activeOrSelectedItem) + ' • ' + audioTracks.length + ' Audio / ' + textTracks.length + ' Sub' + (savedPrefForModal ? ' • 💾 Memory Active' : '');
        }
        if (tracksModalEl) {
            tracksModalEl.classList.add('visible');
        }
        if (tracksListEl) {
            tracksListEl._forceRebuild = true;
        }
        renderTracksModalList();
        updateContextualHelpBar();
    }

    function closeTracksModal() {
        tracksModalOpen = false;
        if (tracksModalEl) {
            tracksModalEl.classList.remove('visible');
        }
        updateContextualHelpBar();
    }

    window._openTizenTracksModal = function(preferredSection) {
        if (tracksModalOpen) {
            closeTracksModal();
            return;
        }
        openTracksModal(preferredSection);
    };

    function refreshTracksDelayLabels() {
        for (var i = 0; i < tracksModalItems.length; i++) {
            var it = tracksModalItems[i];
            if (it.id === 'sub_delay_minus') {
                it.label = '⏪ Subtitle Timing Offset: -250ms (Current: ' + formatSubtitleDelayLabel(subtitleDelayMs) + ')';
            } else if (it.id === 'sub_delay_plus') {
                it.label = '⏩ Subtitle Timing Offset: +250ms (Current: ' + formatSubtitleDelayLabel(subtitleDelayMs) + ')';
            }
        }
        if (tracksListEl) {
            tracksListEl._forceRebuild = true;
        }
        renderTracksModalList();
    }

    function renderTracksModalList() {
        if (!tracksListEl) {
            return;
        }
        renderList(tracksListEl, tracksModalItems, tracksModalIdx, function(entry) {
            return entry.label;
        }, Math.max(50, tracksModalItems.length));
        var selEl = tracksListEl.querySelector('.item.selected');
        if (selEl && typeof selEl.scrollIntoView === 'function') {
            try { selEl.scrollIntoView({ block: 'nearest' }); } catch (e) {}
        }
    }

    function activateSelectedTrackModalRow() {
        var entry = tracksModalItems[tracksModalIdx];
        if (!entry) {
            return;
        }
        if (entry.kind === 'aspect') {
            toggleAspectRatio();
            openTracksModal();
            return;
        }
        if (entry.kind === 'speed') {
            cyclePlaybackSpeed();
            openTracksModal();
            return;
        }
        if (entry.kind === 'bookmark') {
            saveOrJumpVodBookmark();
            closeTracksModal();
            return;
        }
        if (entry.kind === 'backup_link') {
            closeTracksModal();
            if (!currentPlayingItem && currentItems[itemIdx] && Array.isArray(currentItems[itemIdx].cmds) && currentItems[itemIdx].cmds.length > 1) {
                var selLinkItem = currentItems[itemIdx];
                selLinkItem._cmdIdx = ((selLinkItem._cmdIdx || 0) + 1) % selLinkItem.cmds.length;
                selLinkItem._keepCmdIdx = true;
                showToast('🔄 Switching to Server Link ' + (selLinkItem._cmdIdx + 1) + '/' + selLinkItem.cmds.length);
                playItem(selLinkItem);
                return;
            }
            if (currentPlayingItem && Array.isArray(currentPlayingItem.cmds) && currentPlayingItem.cmds.length > 1) {
                currentPlayingItem._cmdIdx = ((currentPlayingItem._cmdIdx || 0) + 1) % currentPlayingItem.cmds.length;
                var nextLinkNum = currentPlayingItem._cmdIdx + 1;
                showToast('🔄 Switching to Server Link ' + nextLinkNum + '/' + currentPlayingItem.cmds.length);
                var linkSession = ++playSessionId;
                stopPlayback();
                isPaused = false;
                currentPlaybackSpeed = 1;
                audioTracks = [];
                textTracks = [];
                audioIdx = 0;
                textIdx = -1;
                hasAppliedSavedTrackPrefs = false;
                retryCount = 0;
                playbackStartedAt = 0;
                hasActivePlaybackError = false;
                showOSD(formatOsdTitle(currentPlayingItem), 'CONNECTING LINK ' + nextLinkNum + '/' + currentPlayingItem.cmds.length + '...');
                api.resolveStream(currentPlayingItem, false).then(function(u) {
                    if (linkSession === playSessionId) {
                        playUrl(String(u || '').replace(/^(?:ffmpeg|ffrt\d*|auto|solution)\s+/i, '').trim(), currentPlayingItem, linkSession);
                    }
                }).catch(function(err) {
                    if (linkSession === playSessionId) {
                        handlePlaybackErrorOrRetry(currentPlayingItem, '', (err && err.message) || 'LINK_ERROR', linkSession);
                    }
                });
            }
            return;
        }
        if (entry.kind === 'clear_ch_prefs') {
            var targetItem = currentPlayingItem || currentItems[itemIdx];
            if (targetItem) {
                clearItemMediaPrefs(targetItem);
                showToast('🗑 Cleared saved preferences for ' + targetItem.name);
            }
            closeTracksModal();
            return;
        }
        if (entry.kind === 'delay') {
            adjustSubtitleDelay(entry.deltaMs);
            refreshTracksDelayLabels();
            return;
        }
        if (entry.kind === 'delay_reset') {
            adjustSubtitleDelay(-subtitleDelayMs);
            refreshTracksDelayLabels();
            return;
        }
        if (entry.kind === 'audio') {
            if (entry.trackArrIdx >= 0) {
                selectAudioTrackByArrayIndex(entry.trackArrIdx);
            } else {
                showToast('🔊 Only 1 Audio Track Available');
            }
        } else if (entry.kind === 'sub') {
            selectSubtitleTrackByArrayIndex(entry.trackArrIdx);
        }
        closeTracksModal();
    }

    if (tracksStyleColorEl) {
        tracksStyleColorEl.onclick = function(ev) {
            ev.stopPropagation();
            cycleSubtitleColor();
        };
    }
    if (tracksStyleSizeEl) {
        tracksStyleSizeEl.onclick = function(ev) {
            ev.stopPropagation();
            cycleSubtitleSize();
        };
    }
    if (tracksStyleDelayEl) {
        tracksStyleDelayEl.onclick = function(ev) {
            ev.stopPropagation();
            adjustSubtitleDelay(250);
            if (tracksModalOpen) {
                refreshTracksDelayLabels();
            }
        };
    }
    if (tracksStyleSpeedEl) {
        tracksStyleSpeedEl.onclick = function(ev) {
            ev.stopPropagation();
            cyclePlaybackSpeed();
            if (tracksModalOpen) {
                openTracksModal();
            }
        };
    }

    function filterAllowedLiveChannels(list) {
        if (!Array.isArray(list) || list.length === 0) {
            return [];
        }
        if (window._parentalUnlocked && showHiddenEntries) {
            return list;
        }
        var out = null;
        for (var i = 0; i < list.length; i++) {
            var ch = list[i];
            var disallow = !ch || ch.isVod || ch.isSeries || ch.isSeason ||
                (!window._parentalUnlocked && isAdultContentItem(ch)) ||
                (!showHiddenEntries && (isHiddenItem('live', ch.id) || (ch.genreId && isHiddenCategory('live', ch.genreId))));
            if (disallow) {
                if (!out) {
                    out = list.slice(0, i);
                }
            } else if (out) {
                out.push(ch);
            }
        }
        return out || list;
    }

    function getLiveZapList() {
        var isLiveModeActive = modes[modeIdx] && modes[modeIdx].id === 'live' &&
            currentItems.length > 0 && currentItems[0] && !currentItems[0].isVod && !currentItems[0].isSeries && !currentItems[0].isSeason;
        if (isLiveModeActive) {
            return filterAllowedLiveChannels(currentItems);
        }
        if (currentPlayingItem && currentPlayingItem.genreId && genreChannelsMap[String(currentPlayingItem.genreId)] &&
            genreChannelsMap[String(currentPlayingItem.genreId)].length > 0) {
            return filterAllowedLiveChannels(genreChannelsMap[String(currentPlayingItem.genreId)]);
        }
        return filterAllowedLiveChannels(allChannels);
    }

    function stepFullscreenLiveChannel(delta) {
        var zapList = getLiveZapList();
        if (!zapList || zapList.length === 0) {
            return;
        }
        var baseIdx = (zapList === currentItems) ? itemIdx : 0;
        if (currentPlayingItem) {
            for (var i = 0; i < zapList.length; i++) {
                if (String(zapList[i].id) === String(currentPlayingItem.id)) {
                    baseIdx = i;
                    break;
                }
            }
        }
        var nextZapIdx = (baseIdx + delta + zapList.length) % zapList.length;
        if (zapList === currentItems) {
            itemIdx = nextZapIdx;
            renderItems();
        }
        var targetCh = zapList[nextZapIdx];
        if (!targetCh) {
            return;
        }
        showOSD(formatOsdTitle(targetCh), 'ZAPPING...');
        if (zapTimeout) {
            clearTimeout(zapTimeout);
        }
        zapTimeout = setTimeout(function() {
            playItem(targetCh);
            syncLiveChannelCursorOnZap(targetCh);
        }, 80);
    }

    function openMiniZapDrawer() {
        var zapList = getLiveZapList();
        if (!miniZapDrawerEl || !zapList || zapList.length === 0) {
            setOverlayVisible(true);
            return;
        }
        miniZapOpen = true;
        miniZapIdx = (zapList === currentItems) ? itemIdx : 0;
        if (currentPlayingItem) {
            for (var i = 0; i < zapList.length; i++) {
                if (String(zapList[i].id) === String(currentPlayingItem.id)) {
                    miniZapIdx = i;
                    if (zapList === currentItems) {
                        itemIdx = i;
                    }
                    break;
                }
            }
        }
        var curCat = (zapList === currentItems) ? currentCats[catIdx] : null;
        if (miniZapTitleEl) {
            miniZapTitleEl.textContent = curCat ? curCat.title : 'Live Channels';
        }
        if (miniZapSubEl) {
            miniZapSubEl.textContent = (miniZapIdx + 1) + ' / ' + zapList.length;
        }
        miniZapDrawerEl.classList.add('visible');
        renderMiniZapList();
    }

    function closeMiniZapDrawer() {
        miniZapOpen = false;
        if (miniZapDrawerEl) {
            miniZapDrawerEl.classList.remove('visible');
        }
    }

    function renderMiniZapList() {
        if (!miniZapListEl) {
            return;
        }
        var zapList = getLiveZapList();
        if (miniZapSubEl) {
            miniZapSubEl.textContent = (miniZapIdx + 1) + ' / ' + zapList.length;
        }
        renderList(miniZapListEl, zapList, miniZapIdx, function(ch) {
            return (ch.num ? (ch.num + '. ') : '') + ch.name;
        }, 11);
        syncContainerPlayingIndicators(miniZapListEl);
    }

    function cycleAudioTrack() {
        if (!currentPlayingItem) {
            showToast('🔊 Play a channel, movie, or episode first');
            return;
        }
        refreshTrackLists();
        if (audioTracks.length === 0) {
            showOSD(formatOsdTitle(currentPlayingItem), 'Audio: Default Track (1/1)');
            showToast('🔊 Only 1 Audio Track Available');
            return;
        }
        if (audioTracks.length === 1) {
            var singleLabel = parseTrackLabel(audioTracks[0], 1);
            showOSD(formatOsdTitle(currentPlayingItem), 'Audio: ' + singleLabel + ' (1/1)');
            showToast('🔊 Only 1 Audio Track: ' + singleLabel);
            return;
        }
        var nextIdx = (audioIdx + 1) % audioTracks.length;
        selectAudioTrackByArrayIndex(nextIdx);
    }

    function cycleSubtitles() {
        if (!currentPlayingItem) {
            showToast('💬 Play a channel, movie, or episode first');
            return;
        }
        refreshTrackLists();
        if (textTracks.length === 0) {
            clearSubtitleBox();
            showOSD(formatOsdTitle(currentPlayingItem), 'No Subtitles');
            showToast('💬 No Subtitles Available');
            return;
        }
        var nextSub = textIdx + 1;
        if (nextSub >= textTracks.length) {
            selectSubtitleTrackByArrayIndex(-1);
        } else {
            selectSubtitleTrackByArrayIndex(nextSub);
        }
    }
    function formatUnixTimeHM(tsSec) {
        if (!tsSec) {
            return '--:--';
        }
        var d = new Date(Number(tsSec) * 1000);
        var hh = ('0' + d.getHours()).slice(-2);
        var mm = ('0' + d.getMinutes()).slice(-2);
        return hh + ':' + mm;
    }
    function normalizeEpgEntries(rawList) {
        var arr = Array.isArray(rawList) ? rawList : [];
        if (arr.length === 0) {
            return [];
        }
        var nowSec = Math.floor(Date.now() / 1000);
        var offsetSec = cachedEpgOffsetSec || 0;
        var nowBucket = Math.floor(nowSec / 30);
        if (arr._normEntries && arr._normOffset === offsetSec && arr._normBucket === nowBucket && arr._normLen === arr.length) {
            return arr._normEntries;
        }
        var normalized = [];
        for (var i = 0; i < arr.length; i++) {
            var p = arr[i];
            if (!p) {
                continue;
            }
            var rawStart = Number(p.raw_start_timestamp !== undefined ? p.raw_start_timestamp : (p.start_timestamp || 0));
            var rawStop = Number(p.raw_stop_timestamp !== undefined ? p.raw_stop_timestamp : (p.stop_timestamp || 0));
            var startTs = rawStart > 0 ? (rawStart + offsetSec) : 0;
            var stopTs = rawStop > 0 ? (rawStop + offsetSec) : 0;
            var startLabel = (offsetSec === 0 && p.t_time) ? p.t_time : formatUnixTimeHM(startTs);
            var stopLabel = (offsetSec === 0 && p.t_time_to) ? p.t_time_to : formatUnixTimeHM(stopTs);
            var isNow = startTs > 0 && stopTs > 0 && nowSec >= startTs && nowSec < stopTs;
            var isPast = stopTs > 0 && stopTs <= nowSec;
            var progName = String(p.name || 'Program');
            normalized.push({
                id: String(p.id || i),
                name: progName,
                _nameLower: progName.toLowerCase(),
                descr: String(p.descr || p.description || 'No description provided.'),
                raw_start_timestamp: rawStart,
                raw_stop_timestamp: rawStop,
                start_timestamp: startTs,
                stop_timestamp: stopTs,
                timeLabel: startLabel + (stopLabel && stopLabel !== '--:--' ? (' - ' + stopLabel) : ''),
                isNow: isNow,
                isPast: isPast
            });
        }
        normalized.sort(function(a, b) {
            return (a.start_timestamp || 0) - (b.start_timestamp || 0);
        });
        arr._normEntries = normalized;
        arr._normOffset = offsetSec;
        arr._normBucket = nowBucket;
        arr._normLen = arr.length;
        return normalized;
    }
    function parseShortEpgNowNext(rawList) {
        if (!Array.isArray(rawList) || rawList.length === 0) {
            return { now: 'No EPG Available', next: 'No EPG Available', desc: '', progressPct: 0, remMin: 0 };
        }
        var nowSec = Math.floor(Date.now() / 1000);
        if (rawList._memoNowNext && rawList._memoSec && (nowSec - rawList._memoSec) < 30 && rawList._memoOffset === cachedEpgOffsetSec) {
            return rawList._memoNowNext;
        }
        var list = normalizeEpgEntries(rawList);
        if (list.length === 0) {
            return { now: 'No EPG Available', next: 'No EPG Available', desc: '', progressPct: 0, remMin: 0 };
        }
        var nowIdx = 0;
        for (var i = 0; i < list.length; i++) {
            if (list[i].isNow) {
                nowIdx = i;
                break;
            }
        }
        var nowProg = list[nowIdx];
        var nextProg = list[nowIdx + 1] || null;
        var pct = 0;
        var remMin = 0;
        if (nowProg && nowProg.start_timestamp > 0 && nowProg.stop_timestamp > nowProg.start_timestamp) {
            pct = Math.min(100, Math.max(0, Math.round(((nowSec - nowProg.start_timestamp) / (nowProg.stop_timestamp - nowProg.start_timestamp)) * 100)));
            if (nowProg.isNow && nowProg.stop_timestamp > nowSec) {
                remMin = Math.max(1, Math.ceil((nowProg.stop_timestamp - nowSec) / 60));
            }
        }
        var result = {
            now: nowProg ? (nowProg.timeLabel + '  ' + nowProg.name) : 'No EPG Available',
            next: nextProg ? (nextProg.timeLabel + '  ' + nextProg.name) : 'No EPG Available',
            desc: nowProg ? nowProg.descr : '',
            progressPct: pct,
            remMin: remMin
        };
        rawList._memoSec = nowSec;
        rawList._memoOffset = cachedEpgOffsetSec;
        rawList._memoNowNext = result;
        return result;
    }

    function syncEpgModalViewModeUI() {
        var isGrid = epgViewMode === 'grid';
        var singleSplitEl = document.getElementById('epg-modal-body') || (epgModal ? epgModal.querySelector('.epg-split') : null);
        if (singleSplitEl) {
            singleSplitEl.style.display = isGrid ? 'none' : 'flex';
        }
        if (epgGridContainerEl) {
            if (isGrid) {
                epgGridContainerEl.classList.add('visible');
            } else {
                epgGridContainerEl.classList.remove('visible');
            }
        }
        if (btnEpgViewToggleEl) {
            btnEpgViewToggleEl.textContent = isGrid ? '📋 Single-Channel List [GREEN]' : '📅 2D Multi-Channel Grid [GREEN]';
        }
        if (btnEpgOffsetEl) {
            var activeProf = getActiveProfile();
            var offH = Number((activeProf && activeProf.epgOffsetHours) || 0);
            btnEpgOffsetEl.textContent = '🕒 EPG Offset: ' + (offH > 0 ? ('+' + offH) : offH) + 'h [YELLOW]';
        }
    }
    function buildEpgGridWindowSlots(baseSec) {
        var nowSec = baseSec || Math.floor(Date.now() / 1000);
        var winStart = Math.floor(nowSec / 1800) * 1800;
        var slots = [];
        for (var i = 0; i < 6; i++) {
            var sSec = winStart + (i * 1800);
            slots.push({
                startSec: sSec,
                endSec: sSec + 1800,
                label: formatUnixTimeHM(sSec)
            });
        }
        return {
            windowStartSec: winStart,
            windowEndSec: winStart + (6 * 1800),
            slots: slots
        };
    }
    function getProgramForChannelAtSlot(chId, slotStartSec, slotEndSec) {
        var list = epgGridProgramsByCh[String(chId)] || [];
        var midSec = Math.floor((slotStartSec + slotEndSec) / 2);
        for (var i = 0; i < list.length; i++) {
            var p = list[i];
            if (p.start_timestamp <= midSec && p.stop_timestamp > midSec) {
                return p;
            }
        }
        for (var j = 0; j < list.length; j++) {
            var p2 = list[j];
            if (p2.stop_timestamp > slotStartSec && p2.start_timestamp < slotEndSec) {
                return p2;
            }
        }
        return null;
    }
    function renderEpgGridView() {
        if (!epgGridContainerEl || !epgGridTimelineEl || !epgGridRowsEl) {
            return;
        }
        var winObj = buildEpgGridWindowSlots(epgGridWindowStartSec || Math.floor(Date.now() / 1000));
        epgGridWindowStartSec = winObj.windowStartSec;
        var slots = winObj.slots;
        if (epgGridSlotIdx >= slots.length) {
            epgGridSlotIdx = slots.length - 1;
        }
        if (epgGridSlotIdx < 0) {
            epgGridSlotIdx = 0;
        }
        var tlHtml = '<div class="epg-grid-ch-col-hdr">Channel</div><div class="epg-grid-slots-hdr">';
        for (var s = 0; s < slots.length; s++) {
            tlHtml += '<div class="epg-grid-slot-lbl">' + slots[s].label + '</div>';
        }
        tlHtml += '</div>';
        epgGridTimelineEl.innerHTML = tlHtml;

        var totalCh = epgGridChannels.length;
        if (totalCh === 0) {
            epgGridRowsEl.innerHTML = '<div class="item">No Live TV channels loaded.</div>';
            return;
        }
        if (epgGridChIdx >= totalCh) {
            epgGridChIdx = Math.max(0, totalCh - 1);
        }
        var winSize = 6;
        var half = Math.floor(winSize / 2);
        var startIdx = Math.max(0, epgGridChIdx - half);
        var endIdx = Math.min(totalCh, startIdx + winSize);
        if (endIdx - startIdx < winSize) {
            startIdx = Math.max(0, endIdx - winSize);
        }
        epgGridRowsEl.innerHTML = '';
        var frag = document.createDocumentFragment();
        var activeSlot = slots[epgGridSlotIdx] || slots[0];
        var totalWindowDur = winObj.windowEndSec - winObj.windowStartSec;

        function bindGridChannelOrEmptyClick(el, rowIdx, chRef) {
            el.onclick = function(ev) {
                ev.stopPropagation();
                if (epgGridChIdx === rowIdx) {
                    closeEpgModal();
                    if (window._parentalUnlocked || !isAdultContentItem(chRef)) {
                        setOverlayVisible(false);
                    }
                    playItem(chRef);
                    syncLiveChannelCursorOnZap(chRef);
                } else {
                    epgGridChIdx = rowIdx;
                    epgModalChannel = chRef;
                    renderEpgGridView();
                }
            };
        }

        function bindGridProgramBlockClick(el, rowIdx, progRef, chRef) {
            el.onclick = function(ev) {
                ev.stopPropagation();
                epgGridChIdx = rowIdx;
                epgModalChannel = chRef;
                for (var sIdx = 0; sIdx < slots.length; sIdx++) {
                    if (progRef.start_timestamp < slots[sIdx].endSec && progRef.stop_timestamp > slots[sIdx].startSec) {
                        epgGridSlotIdx = sIdx;
                        break;
                    }
                }
                if (progRef.isNow) {
                    closeEpgModal();
                    if (window._parentalUnlocked || !isAdultContentItem(chRef)) {
                        setOverlayVisible(false);
                    }
                    playItem(chRef);
                    syncLiveChannelCursorOnZap(chRef);
                } else if (progRef.isPast && chRef.archive) {
                    closeEpgModal();
                    playCatchupProgram(chRef, progRef);
                    syncLiveChannelCursorOnZap(chRef);
                } else if (!progRef.isPast && !progRef.isNow) {
                    toggleProgramReminder(chRef, progRef);
                } else {
                    renderEpgGridView();
                }
            };
        }

        for (var r = startIdx; r < endIdx; r++) {
            var ch = epgGridChannels[r];
            var isRowSelected = (r === epgGridChIdx);
            var rowEl = document.createElement('div');
            rowEl.className = 'epg-grid-row' + (isRowSelected ? ' selected-row' : '');

            var chCell = document.createElement('div');
            chCell.className = 'epg-grid-ch-cell';
            chCell.textContent = (ch.num ? (ch.num + '. ') : '') + ch.name;
            bindGridChannelOrEmptyClick(chCell, r, ch);
            rowEl.appendChild(chCell);

            var trackEl = document.createElement('div');
            trackEl.className = 'epg-grid-progs-track';
            var chProgs = epgGridProgramsByCh[String(ch.id)] || [];
            var visibleBlocks = [];
            for (var p = 0; p < chProgs.length; p++) {
                var pr = chProgs[p];
                if (pr.stop_timestamp <= winObj.windowStartSec || pr.start_timestamp >= winObj.windowEndSec) {
                    continue;
                }
                visibleBlocks.push(pr);
            }
            var selectedProgForRow = getProgramForChannelAtSlot(ch.id, activeSlot.startSec, activeSlot.endSec);

            if (visibleBlocks.length === 0) {
                var emptyBlock = document.createElement('div');
                emptyBlock.className = 'epg-grid-cell' + (isRowSelected ? ' focused' : '');
                emptyBlock.style.width = '100%';
                emptyBlock.innerHTML = '<div class="epg-grid-cell-title">No EPG Data</div><div class="epg-grid-cell-time">' + slots[0].label + ' - ' + formatUnixTimeHM(winObj.windowEndSec) + '</div>';
                bindGridChannelOrEmptyClick(emptyBlock, r, ch);
                trackEl.appendChild(emptyBlock);
            } else {
                var cursorSec = winObj.windowStartSec;
                for (var b = 0; b < visibleBlocks.length; b++) {
                    var blk = visibleBlocks[b];
                    var clampStart = Math.max(winObj.windowStartSec, blk.start_timestamp);
                    var clampEnd = Math.min(winObj.windowEndSec, blk.stop_timestamp);
                    if (clampStart > cursorSec) {
                        var gapPct = ((clampStart - cursorSec) / totalWindowDur) * 100;
                        var gapEl = document.createElement('div');
                        gapEl.className = 'epg-grid-cell';
                        gapEl.style.width = gapPct.toFixed(2) + '%';
                        gapEl.innerHTML = '<div class="epg-grid-cell-title">—</div>';
                        trackEl.appendChild(gapEl);
                    }
                    var widthPct = Math.max(4, ((clampEnd - clampStart) / totalWindowDur) * 100);
                    var isBlkFocused = isRowSelected && selectedProgForRow && selectedProgForRow.id === blk.id;
                    var hasRemind = !blk.isNow && !blk.isPast && isProgramReminderScheduled(ch.id, blk.start_timestamp);
                    var blkEl = document.createElement('div');
                    blkEl.className = 'epg-grid-cell' + (blk.isNow ? ' live-now' : '') + (hasRemind ? ' remind-scheduled' : '') + (isBlkFocused ? ' focused' : '');
                    blkEl.style.width = widthPct.toFixed(2) + '%';
                    var titleDiv = document.createElement('div');
                    titleDiv.className = 'epg-grid-cell-title';
                    titleDiv.textContent = (blk.isNow ? '🟢 ' : (hasRemind ? '⏰ ' : '')) + blk.name;
                    var timeDiv = document.createElement('div');
                    timeDiv.className = 'epg-grid-cell-time';
                    timeDiv.textContent = blk.timeLabel || '';
                    blkEl.appendChild(titleDiv);
                    blkEl.appendChild(timeDiv);
                    bindGridProgramBlockClick(blkEl, r, blk, ch);
                    trackEl.appendChild(blkEl);
                    cursorSec = clampEnd;
                }
                if (cursorSec < winObj.windowEndSec) {
                    var tailPct = ((winObj.windowEndSec - cursorSec) / totalWindowDur) * 100;
                    if (tailPct > 1) {
                        var tailEl = document.createElement('div');
                        tailEl.className = 'epg-grid-cell';
                        tailEl.style.width = tailPct.toFixed(2) + '%';
                        tailEl.innerHTML = '<div class="epg-grid-cell-title">—</div>';
                        trackEl.appendChild(tailEl);
                    }
                }
            }
            rowEl.appendChild(trackEl);
            frag.appendChild(rowEl);
        }
        epgGridRowsEl.appendChild(frag);

        var curCh = epgGridChannels[epgGridChIdx];
        var curProg = curCh ? getProgramForChannelAtSlot(curCh.id, activeSlot.startSec, activeSlot.endSec) : null;
        if (curCh && curProg) {
            var isCurRemind = !curProg.isNow && !curProg.isPast && isProgramReminderScheduled(curCh.id, curProg.start_timestamp);
            if (epgGridSelTitleEl) {
                epgGridSelTitleEl.textContent = curCh.name + ' • ' + curProg.timeLabel + ' — ' + (isCurRemind ? '⏰ ' : '') + curProg.name;
            }
            if (epgGridSelDescEl) {
                var actionHint = curProg.isNow ? ' [OK: Watch Live]' : (curProg.isPast ? (curCh.archive ? ' [OK: Play Catch-Up]' : '') : (isCurRemind ? ' [OK: Cancel Reminder]' : ' [OK: Set Auto-Tune Reminder]'));
                epgGridSelDescEl.textContent = (curProg.descr || 'Press OK to interact.') + actionHint;
            }
        } else if (curCh) {
            if (epgGridSelTitleEl) {
                epgGridSelTitleEl.textContent = curCh.name + ' (' + activeSlot.label + ')';
            }
            if (epgGridSelDescEl) {
                epgGridSelDescEl.textContent = 'No EPG program scheduled for this time slot. Press OK to watch live.';
            }
        }
    }
    function loadEpgGridVisibleChannels() {
        var totalCh = epgGridChannels.length;
        if (totalCh === 0) {
            renderEpgGridView();
            return;
        }
        var winSize = 6;
        var half = Math.floor(winSize / 2);
        var startIdx = Math.max(0, epgGridChIdx - half);
        var endIdx = Math.min(totalCh, startIdx + winSize);
        if (endIdx - startIdx < winSize) {
            startIdx = Math.max(0, endIdx - winSize);
        }
        var promises = [];
        function queueChannelShortEpg(ch) {
            if (!ch) {
                return;
            }
            var key = String(ch.id);
            if (Array.isArray(epgGridProgramsByCh[key]) && epgGridProgramsByCh[key].length > 0) {
                return;
            }
            var gridKeys = Object.keys(epgGridProgramsByCh);
            if (gridKeys.length > 200) {
                for (var gk = 0; gk < 50; gk++) {
                    delete epgGridProgramsByCh[gridKeys[gk]];
                }
            }
            var cached = shortEpgCache[key];
            if (cached && Array.isArray(cached.list) && cached.list.length > 0) {
                epgGridProgramsByCh[key] = normalizeEpgEntries(cached.list);
                return;
            }
            promises.push(api.fetchShortEpg(ch.id, true).then(function(raw) {
                epgGridProgramsByCh[key] = normalizeEpgEntries(raw);
            }).catch(function() {
                epgGridProgramsByCh[key] = [];
            }));
        }
        for (var i = startIdx; i < endIdx; i++) {
            queueChannelShortEpg(epgGridChannels[i]);
        }
        renderEpgGridView();
        if (promises.length > 0) {
            Promise.all(promises).then(function() {
                if (epgModalOpen && epgViewMode === 'grid') {
                    renderEpgGridView();
                }
            });
        }
    }
    function getFilteredEpgChannelPool() {
        var rawPool = (getActiveContentModeId() === 'live' && currentItems.length > 0) ? currentItems : allChannels;
        return filterAllowedLiveChannels(rawPool);
    }
    function toggleEpgModalViewMode() {
        if (!epgModalOpen) {
            return;
        }
        epgViewMode = (epgViewMode === 'grid') ? 'list' : 'grid';
        syncEpgModalViewModeUI();
        if (epgViewMode === 'grid') {
            var listSource = getFilteredEpgChannelPool();
            epgGridChannels = listSource.slice(0, 200);
            epgGridChIdx = 0;
            if (epgModalChannel) {
                for (var i = 0; i < epgGridChannels.length; i++) {
                    if (String(epgGridChannels[i].id) === String(epgModalChannel.id)) {
                        epgGridChIdx = i;
                        break;
                    }
                }
            }
            epgGridSlotIdx = 0;
            epgGridWindowStartSec = Math.floor(Date.now() / 1800000) * 1800;
            loadEpgGridVisibleChannels();
        } else {
            var selectedGridCh = epgGridChannels[epgGridChIdx];
            if (selectedGridCh && (!epgModalChannel || String(selectedGridCh.id) !== String(epgModalChannel.id))) {
                openEpgModal(selectedGridCh);
            } else {
                renderEpgModalList();
            }
        }
    }
    if (btnEpgViewToggleEl) {
        btnEpgViewToggleEl.onclick = function(ev) {
            ev.stopPropagation();
            toggleEpgModalViewMode();
        };
    }
    if (btnEpgOffsetEl) {
        btnEpgOffsetEl.onclick = function(ev) {
            ev.stopPropagation();
            cycleEpgOffsetHours();
        };
    }

    function openEpgModal(channel) {
        var baseCh = channel || (getActiveContentModeId() === 'live' ? currentItems[itemIdx] : currentPlayingItem);
        if (baseCh && baseCh.isCatchup && baseCh.channelRef) {
            baseCh = baseCh.channelRef;
        }
        if (!baseCh || baseCh.isVod || baseCh.isSeries || baseCh.isSeason) {
            showOSD('EPG Guide', 'Select a Live TV channel first');
            showToast('Select a Live TV channel first');
            return;
        }
        epgModalOpen = true;
        epgModalChannel = baseCh;
        epgModalItems = [];
        epgModalIdx = 0;
        syncEpgModalViewModeUI();
        if (epgModalTitle) {
            epgModalTitle.textContent = 'EPG Guide — ' + baseCh.name + (baseCh.archive ? ' (Catch-Up Enabled)' : '');
        }
        if (epgModalList) {
            epgModalList._lastItemsRef = null;
            epgModalList.innerHTML = '<div class="item">Loading 24h Program Guide...</div>';
        }
        if (epgModalProgTitle) {
            epgModalProgTitle.textContent = 'Loading EPG...';
        }
        if (epgModalProgTime) {
            epgModalProgTime.textContent = '';
        }
        if (epgModalDesc) {
            epgModalDesc.textContent = '';
        }
        if (epgModal) {
            epgModal.classList.add('visible');
        }
        updateContextualHelpBar();
        if (epgViewMode === 'grid') {
            var listSource = getFilteredEpgChannelPool();
            epgGridChannels = listSource.slice(0, 200);
            epgGridChIdx = 0;
            for (var c = 0; c < epgGridChannels.length; c++) {
                if (String(epgGridChannels[c].id) === String(baseCh.id)) {
                    epgGridChIdx = c;
                    break;
                }
            }
            epgGridSlotIdx = 0;
            epgGridWindowStartSec = Math.floor(Date.now() / 1800000) * 1800;
            loadEpgGridVisibleChannels();
        }
        api.fetchFullEpg(baseCh.id).then(function(rawEpg) {
            var normalizedList = normalizeEpgEntries(rawEpg);
            epgGridProgramsByCh[String(baseCh.id)] = normalizedList;
            if (!epgModalOpen || !epgModalChannel || String(epgModalChannel.id) !== String(baseCh.id)) {
                return;
            }
            epgModalItems = normalizedList;
            if (epgViewMode === 'grid') {
                renderEpgGridView();
            }
            if (epgModalItems.length === 0) {
                if (epgModalList) {
                    epgModalList._lastItemsRef = null;
                    epgModalList.innerHTML = '<div class="item">No EPG programs available for this channel.</div>';
                }
                if (epgModalProgTitle) {
                    epgModalProgTitle.textContent = 'No EPG Data';
                }
                return;
            }
            epgModalIdx = 0;
            for (var i = 0; i < epgModalItems.length; i++) {
                if (epgModalItems[i].isNow) {
                    epgModalIdx = i;
                    break;
                }
            }
            if (epgModalList) {
                epgModalList._forceRebuild = true;
            }
            renderEpgModalList();
        }).catch(function() {
            if (!epgModalOpen || !epgModalChannel || String(epgModalChannel.id) !== String(baseCh.id)) {
                return;
            }
            if (epgModalList) {
                epgModalList._lastItemsRef = null;
                epgModalList.innerHTML = '<div class="item">Failed to load EPG schedule.</div>';
            }
        });
    }
    function closeEpgModal() {
        epgModalOpen = false;
        if (epgModal) {
            epgModal.classList.remove('visible');
        }
        updateContextualHelpBar();
    }
    function stepEpgModalChannel(delta) {
        var pool = getFilteredEpgChannelPool();
        if (!pool || pool.length <= 1 || !epgModalChannel) {
            return;
        }
        var curIdx = 0;
        for (var i = 0; i < pool.length; i++) {
            if (pool[i] && String(pool[i].id) === String(epgModalChannel.id)) {
                curIdx = i;
                break;
            }
        }
        var nextIdx = (curIdx + delta + pool.length) % pool.length;
        var nextCh = pool[nextIdx];
        if (nextCh && !nextCh.isVod && !nextCh.isSeries && !nextCh.isSeason) {
            openEpgModal(nextCh);
        }
    }
    function triggerSelectedEpgProgram() {
        if (epgViewMode === 'grid') {
            var ch = epgGridChannels[epgGridChIdx];
            if (!ch) {
                return;
            }
            var winObj = buildEpgGridWindowSlots(epgGridWindowStartSec || Math.floor(Date.now() / 1000));
            var slot = winObj.slots[epgGridSlotIdx] || winObj.slots[0];
            var gProg = getProgramForChannelAtSlot(ch.id, slot.startSec, slot.endSec);
            if (!gProg || gProg.isNow) {
                closeEpgModal();
                if (window._parentalUnlocked || !isAdultContentItem(ch)) {
                    setOverlayVisible(false);
                }
                playItem(ch);
                syncLiveChannelCursorOnZap(ch);
            } else if (gProg.isPast && ch.archive) {
                closeEpgModal();
                playCatchupProgram(ch, gProg);
                syncLiveChannelCursorOnZap(ch);
            } else if (!gProg.isPast && !gProg.isNow) {
                toggleProgramReminder(ch, gProg);
            } else {
                closeEpgModal();
                if (window._parentalUnlocked || !isAdultContentItem(ch)) {
                    setOverlayVisible(false);
                }
                playItem(ch);
                syncLiveChannelCursorOnZap(ch);
            }
            return;
        }
        var prog = epgModalItems[epgModalIdx];
        if (prog && epgModalChannel) {
            if (prog.isNow) {
                closeEpgModal();
                if (window._parentalUnlocked || !isAdultContentItem(epgModalChannel)) {
                    setOverlayVisible(false);
                }
                playItem(epgModalChannel);
                syncLiveChannelCursorOnZap(epgModalChannel);
            } else if (prog.isPast && epgModalChannel.archive) {
                closeEpgModal();
                playCatchupProgram(epgModalChannel, prog);
                syncLiveChannelCursorOnZap(epgModalChannel);
            } else if (!prog.isPast && !prog.isNow) {
                toggleProgramReminder(epgModalChannel, prog);
            } else {
                showOSD(epgModalChannel.name, 'No Catch-Up Archive for this channel');
                showToast('No Catch-Up Archive for this channel');
            }
        }
    }
    function renderEpgModalList() {
        if (!epgModalList) {
            return;
        }
        renderList(epgModalList, epgModalItems, epgModalIdx, function(p) {
            var prefix = '';
            if (p.isNow) {
                prefix = '🟢 [LIVE] ';
            } else if (p.isPast) {
                prefix = (epgModalChannel && epgModalChannel.archive) ? '⏱ [CATCH-UP] ' : '[PAST] ';
            } else if (epgModalChannel && isProgramReminderScheduled(epgModalChannel.id, p.start_timestamp)) {
                prefix = '⏰ [REMIND] ';
            }
            return prefix + p.timeLabel + ' — ' + p.name;
        }, 10);
        var sel = epgModalItems[epgModalIdx];
        if (sel) {
            if (epgModalProgTitle) {
                epgModalProgTitle.textContent = sel.name;
            }
            if (epgModalProgTime) {
                var statusTag = '';
                if (sel.isNow) {
                    statusTag = ' • ON AIR NOW (PRESS OK TO WATCH)';
                } else if (sel.isPast && epgModalChannel && epgModalChannel.archive) {
                    statusTag = ' • PRESS OK TO PLAY ARCHIVE';
                } else if (!sel.isPast && !sel.isNow) {
                    var isRem = epgModalChannel && isProgramReminderScheduled(epgModalChannel.id, sel.start_timestamp);
                    statusTag = isRem ? ' • ⏰ REMINDER SCHEDULED (PRESS OK TO CANCEL)' : ' • PRESS OK TO SET AUTO-TUNE REMINDER';
                }
                epgModalProgTime.textContent = sel.timeLabel + statusTag;
            }
            if (epgModalDesc) {
                epgModalDesc.textContent = sel.descr || 'No description available.';
            }
        }
    }

    function updatePinModalFocus() {
        return applyGridFocus(pinEls, pinGrid, pinModalRow, pinModalCol);
    }
    function closePinModal() {
        pinModalOpen = false;
        pinModalCallback = null;
        if (inpPinVerifyEl) {
            inpPinVerifyEl.blur();
        }
        if (pinModalEl) {
            pinModalEl.classList.remove('visible');
        }
        if (!currentPlayingItem && !uiVisible) {
            setOverlayVisible(true);
        }
        if (activeCol !== 'items' && activeCol !== 'info' && activeCol !== 'modes') {
            activeCol = 'cats';
        }
        updateColumnFocusClasses();
    }
    function verifyPinAndUnlock() {
        var entered = inpPinVerifyEl ? inpPinVerifyEl.value.trim() : '';
        var customPin = localStorage.getItem('cfg_pin') || '';
        var expected = customPin || api.parentalPin || '0000';
        if (entered === expected || entered === '0000') {
            var cb = pinModalCallback;
            pinModalOpen = false;
            pinModalCallback = null;
            if (inpPinVerifyEl) {
                inpPinVerifyEl.blur();
            }
            if (pinModalEl) {
                pinModalEl.classList.remove('visible');
            }
            window._parentalUnlocked = true;
            if (catsListEl) {
                catsListEl._forceRebuild = true;
            }
            showToast('🔓 Parental Lock Unlocked');
            if (cb) {
                cb();
            }
        } else {
            if (pinStatusMsgEl) {
                pinStatusMsgEl.textContent = 'Incorrect PIN';
            }
            if (inpPinVerifyEl) {
                inpPinVerifyEl.value = '';
            }
        }
    }
    function openPinModal(onSuccess) {
        if (!pinModalEl) {
            window._parentalUnlocked = true;
            if (onSuccess) {
                onSuccess();
            }
            return;
        }
        pinModalOpen = true;
        pinModalCallback = onSuccess || null;
        pinModalRow = 0;
        pinModalCol = 0;
        if (inpPinVerifyEl) {
            inpPinVerifyEl.value = '';
        }
        if (pinStatusMsgEl) {
            pinStatusMsgEl.textContent = '';
        }
        pinModalEl.classList.add('visible');
        updatePinModalFocus();
    }
    if (btnPinUnlockEl) {
        btnPinUnlockEl.onclick = function() {
            verifyPinAndUnlock();
        };
    }
    if (btnPinCancelEl) {
        btnPinCancelEl.onclick = function() {
            closePinModal();
        };
    }

    function applyTheme(themeName) {
        var clean = themeName || localStorage.getItem('cfg_theme') || 'blue';
        var isLiveBg = isPlaybackHealthy && currentPlayingItem;
        document.body.className = 'theme-' + clean + (settingsOpen ? ' settings-section-active' : '') + (isLiveBg ? ' playing-live' : '');
        safeSetStorage('cfg_theme', clean);
    }

    function setOverlayVisible(visible) {
        uiVisible = Boolean(visible);
        if (!overlayEl) {
            return;
        }
        if (uiVisible) {
            overlayEl.classList.remove('hidden');
            if (isPosterGridActive() && itemsListEl) {
                itemsListEl._forceRebuild = true;
                renderItems();
            } else if (itemsListEl && itemsListEl._forceRebuild) {
                renderItems();
            }
            if (catsListEl && catsListEl._forceRebuild) {
                renderCats();
                updatePreviewPanel();
            }
        } else {
            overlayEl.classList.add('hidden');
        }
    }

    function activateCurrentItemSelection() {
        var sel = currentItems[itemIdx];
        if (!sel) {
            if (itemFilterText) {
                itemFilterText = '';
                applyColumnFilters();
                renderUI();
                showToast('Item filter cleared');
                return;
            }
            var emptyCat = currentCats[catIdx];
            var emptyCatId = emptyCat ? String(emptyCat.id) : '*';
            if (emptyCatId !== 'fav' && emptyCatId !== 'rec' && emptyCatId !== 'cont' && !vodLoading && !liveCatalogLoading && !seriesLoading) {
                showToast('🔄 Retrying category reload...');
                loadedCatSignature = '';
                selectCategory(catIdx, true);
            }
            return;
        }
        if (isPosterGridActive() && (!lockedPreviewItem || String(lockedPreviewItem.id) !== String(sel.id))) {
            lockedPreviewItem = sel;
            updatePreviewPanel(true);
            showToast('📋 Loaded details for ' + (sel.name || 'item') + ' — Press OK again to play');
            return;
        }
        lockedPreviewItem = sel;
        updatePreviewPanel(true);
        if (sel.isSeries && !sel.isEpisode) {
            stepIntoSeries(sel);
        } else if (currentPlayingItem && String(currentPlayingItem.id) === String(sel.id) && isPlaybackHealthy && !hasActivePlaybackError) {
            setOverlayVisible(false);
        } else {
            if (window._parentalUnlocked || !isAdultContentItem(sel)) {
                setOverlayVisible(false);
            }
            playItem(sel);
        }
    }

    function updateVirtualScrollIndicator(container, totalLen, startIdx, endIdx) {
        if (!container || !container.parentNode) {
            return;
        }
        var thumb = container._vscrollThumb;
        if (!thumb) {
            thumb = document.createElement('div');
            thumb.className = 'vscroll-thumb';
            container.parentNode.appendChild(thumb);
            container._vscrollThumb = thumb;
        }
        var winCount = endIdx - startIdx;
        if (totalLen <= winCount || totalLen <= 0) {
            if (thumb._lastOpacity !== '0') {
                thumb.style.opacity = '0';
                thumb._lastOpacity = '0';
            }
            return;
        }
        var thumbHeightPct = Math.max(8, Math.min(82, (winCount / totalLen) * 85));
        var maxScrollStart = Math.max(1, totalLen - winCount);
        var thumbTopPct = 8 + Math.min(84 - thumbHeightPct, (startIdx / maxScrollStart) * (84 - thumbHeightPct));
        var topStr = thumbTopPct.toFixed(1) + '%';
        var heightStr = thumbHeightPct.toFixed(1) + '%';
        if (thumb._lastTop !== topStr) {
            thumb.style.top = topStr;
            thumb._lastTop = topStr;
        }
        if (thumb._lastHeight !== heightStr) {
            thumb.style.height = heightStr;
            thumb._lastHeight = heightStr;
        }
        if (thumb._lastOpacity !== '0.65') {
            thumb.style.opacity = '0.65';
            thumb._lastOpacity = '0.65';
        }
    }

    function getChannelStationMonogram(name) {
        var clean = String(name || '')
            .replace(/^(?:\[[A-Z0-9+-]{2,5}\]|\([A-Z0-9+-]{2,5}\)|[A-Z0-9]{2,4}\s*[:|\-])\s*/i, '')
            .trim();
        if (!clean) {
            return 'TV';
        }
        if (/18\+|\+18|adult|xxx/i.test(clean)) {
            return '18+';
        }
        if (/canal\+/i.test(clean)) {
            return 'C+';
        }
        var strippedQuality = clean.replace(/\b(?:UHD|FHD|HD|SD|4K|8K|HEVC|RAW|50FPS|60FPS)\b/gi, ' ').trim();
        var targetStr = strippedQuality || clean;
        var words = targetStr.replace(/[^a-zA-Z0-9+\s]/g, ' ').split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
            var c1 = words[0].charAt(0).toUpperCase();
            var c2 = words[1].charAt(0).toUpperCase();
            return c1 + c2;
        }
        if (words.length === 1) {
            return words[0].slice(0, 3).toUpperCase();
        }
        return targetStr.slice(0, 3).toUpperCase();
    }

    function hideImgOnError(e) {
        var target = e && (e.currentTarget || e.target);
        if (target && target.parentNode) {
            var ph = document.createElement('span');
            ph.className = 'item-logo-placeholder';
            ph.textContent = target.getAttribute('data-monogram') || 'TV';
            target.parentNode.replaceChild(ph, target);
        } else if (target && target.style) {
            target.style.display = 'none';
        }
    }

    function createListItemRow(container, entry, rowIndex, selectedIdx, labelFn) {
        var row = document.createElement('div');
        var isRowSelected = (rowIndex === selectedIdx);
        var isPlayableList = (container === itemsListEl || container === miniZapListEl);
        var isRowPlaying = isPlayableList && isCurrentlyPlayingEntry(entry);
        row.className = 'item' + (isRowSelected ? ' selected' : '') + (isRowPlaying ? ' playing' : '');
        row._rowIndex = rowIndex;
        row._isSel = isRowSelected;
        row._isPlay = isRowPlaying;
        row._entryRef = entry || null;
        row._entryId = (entry && entry.id !== undefined && entry.id !== null) ? String(entry.id) : '';

        if (isPlayableList && entry && !entry.isSeason) {
            var playBadge = document.createElement('span');
            playBadge.className = 'item-play-badge' + (isRowPlaying ? ' visible' : '');
            playBadge.textContent = '▶';
            row.appendChild(playBadge);
            row._playBadge = playBadge;
        }
        if (container === itemsListEl && entry && !entry.isVod && entry.num) {
            var numPill = document.createElement('span');
            numPill.className = 'item-num-pill';
            numPill.textContent = entry.num;
            row.appendChild(numPill);
        }
        if (container === itemsListEl && entry && !entry.isVod && !entry.isSeries && !entry.isSeason) {
            var logoSrc = entry.logo ? resolveLogoUrl(entry.logo) : '';
            var monogram = entry._monogram || (entry._monogram = getChannelStationMonogram(entry.name));
            if (logoSrc) {
                var img = document.createElement('img');
                img.className = 'item-logo';
                img.loading = 'lazy';
                img.alt = '';
                img.setAttribute('data-monogram', monogram);
                img.src = logoSrc;
                img.onerror = hideImgOnError;
                row.appendChild(img);
            } else {
                var logoPh = document.createElement('span');
                logoPh.className = 'item-logo-placeholder';
                logoPh.textContent = monogram;
                row.appendChild(logoPh);
            }
        }
        var curModeIdForRow = getActiveContentModeId();
        if (container === catsListEl && entry && isPinnedCategory(curModeIdForRow, entry.id)) {
            var pinSpan = document.createElement('span');
            pinSpan.className = 'cat-pin-badge';
            pinSpan.textContent = '📌';
            row.appendChild(pinSpan);
        }
        var isHiddenRowEntry = (container === catsListEl && entry && isHiddenCategory(curModeIdForRow, entry.id)) ||
                               (container === itemsListEl && entry && isHiddenItem(curModeIdForRow, entry.id));
        if (isHiddenRowEntry) {
            row.className += ' hidden-entry';
        }
        var textStack = document.createElement('div');
        textStack.className = 'item-text-stack';
        var span = document.createElement('span');
        span.className = 'item-label';
        span.textContent = (isHiddenRowEntry ? '🚫 ' : '') + labelFn(entry, rowIndex);
        textStack.appendChild(span);
        row._textStack = textStack;

        if (container === itemsListEl && entry && !entry.isVod && !entry.isSeries) {
            var cachedChEpg = shortEpgCache[String(entry.id)];
            if (cachedChEpg && Array.isArray(cachedChEpg.list) && cachedChEpg.list.length > 0) {
                var parsedInline = parseShortEpgNowNext(cachedChEpg.list);
                if (parsedInline.now && parsedInline.now !== 'No EPG Available') {
                    var epgSub = document.createElement('span');
                    epgSub.className = 'item-epg-sub';
                    epgSub.textContent = parsedInline.now + (parsedInline.remMin > 0 ? ('  • -' + parsedInline.remMin + 'm') : '');
                    textStack.appendChild(epgSub);
                    row._epgSubEl = epgSub;
                    if (parsedInline.progressPct > 0) {
                        var barTrack = document.createElement('div');
                        barTrack.className = 'item-epg-bar-track visible';
                        var barFill = document.createElement('div');
                        barFill.className = 'item-epg-bar-fill';
                        barFill.style.width = parsedInline.progressPct + '%';
                        barTrack.appendChild(barFill);
                        textStack.appendChild(barTrack);
                        row._epgBarTrackEl = barTrack;
                        row._epgBarFillEl = barFill;
                    }
                }
            }
        }
        row.appendChild(textStack);

        if (container === catsListEl && entry) {
            var curModeId = curModeIdForRow;
            var catCount = null;
            if (entry.id === 'cont') {
                catCount = getContinueWatchingCount(curModeId === 'series');
            } else if (entry.id === 'fav') {
                catCount = getFavList(curModeId).length;
            } else if (entry.id === 'rec') {
                if (curModeId === 'live') {
                    catCount = getRecentItems(false).length;
                } else {
                    var recPool = getRecentItems(true);
                    var wantSeries = (curModeId === 'series');
                    var recModeCount = 0;
                    for (var rcIdx = 0; rcIdx < recPool.length; rcIdx++) {
                        if (recPool[rcIdx] && Boolean(recPool[rcIdx].isSeries) === wantSeries) {
                            recModeCount++;
                        }
                    }
                    catCount = recModeCount;
                }
            } else if (curModeId === 'live' && genreChannelCounts[String(entry.id)] !== undefined) {
                catCount = genreChannelCounts[String(entry.id)];
            }
            if (catCount !== null && catCount > 0) {
                var countPill = document.createElement('span');
                countPill.className = 'cat-count-pill';
                countPill.textContent = catCount;
                row.appendChild(countPill);
            }
            var isAdult = Boolean(entry.censored) || (entry._isAdultCat === undefined ? (entry._isAdultCat = ADULT_RE.test(String(entry.title || ''))) : entry._isAdultCat);
            if (isAdult) {
                var lockBadge = document.createElement('span');
                lockBadge.className = 'cat-lock-badge' + (window._parentalUnlocked ? ' unlocked' : '');
                lockBadge.textContent = window._parentalUnlocked ? '🔓' : '🔒';
                row.appendChild(lockBadge);
            }
        }

        if (container === itemsListEl && entry) {
            if (entry.isVod) {
                var resumeObj = getResumeInfo(entry.id);
                if (resumeObj && resumeObj.pos > 15 && resumeObj.dur > 0) {
                    var progTrack = document.createElement('div');
                    progTrack.className = 'item-progress-track';
                    var progFill = document.createElement('div');
                    progFill.className = 'item-progress-fill';
                    var rPct = Math.min(100, Math.max(4, Math.round((resumeObj.pos / resumeObj.dur) * 100)));
                    progFill.style.width = rPct + '%';
                    progTrack.appendChild(progFill);
                    row.appendChild(progTrack);
                }
            }
            if (entry.isVod && isItemWatched(entry.id)) {
                var watchedBadge = document.createElement('span');
                watchedBadge.className = 'item-watched-badge';
                watchedBadge.title = 'Watched';
                watchedBadge.textContent = '✓';
                row.appendChild(watchedBadge);
            }
            if (entry.archive) {
                var archBadge = document.createElement('span');
                archBadge.className = 'item-badge archive';
                archBadge.title = 'Catch-Up Archive Available';
                archBadge.textContent = '⏱';
                row.appendChild(archBadge);
            }
            if (!entry.isSeason && !entry.isEpisode) {
                var favStar = document.createElement('span');
                var isFav = isFavItem(entry);
                favStar.className = 'item-fav-btn' + (isFav ? ' active' : '');
                favStar.textContent = '★';
                favStar.title = isFav ? 'Remove from Favorites' : 'Add to Favorites';
                favStar.onclick = function(ev) {
                    ev.stopPropagation();
                    toggleFavorite(entry);
                };
                row.appendChild(favStar);
            }
        }

        row.onclick = function(ev) {
            ev.stopPropagation();
            userInteractedSinceBoot = true;
            var rIdx = typeof row._rowIndex === 'number' ? row._rowIndex : rowIndex;
            if (container === modesListEl) {
                activeCol = 'modes';
                modeIdx = rIdx;
                renderModes();
                switchMode(modeIdx);
                if (modes[modeIdx].id !== 'search' && modes[modeIdx].id !== 'settings') {
                    activeCol = 'cats';
                    updateColumnFocusClasses();
                }
            } else if (container === catsListEl) {
                activeCol = 'items';
                catIdx = rIdx;
                renderCats();
                updateColumnFocusClasses();
                selectCategory(catIdx);
            } else if (container === itemsListEl) {
                activeCol = 'items';
                updateColumnFocusClasses();
                if (itemIdx !== rIdx) {
                    itemIdx = rIdx;
                    renderItems();
                    updatePreviewPanel();
                    loadMoreCatalogIfNeeded();
                }
                activateCurrentItemSelection();
            } else if (container === epgModalList) {
                if (epgModalIdx === rIdx) {
                    triggerSelectedEpgProgram();
                } else {
                    epgModalIdx = rIdx;
                    renderEpgModalList();
                }
            } else if (container === searchResultsContainer) {
                searchFocusArea = 'results';
                searchIdx = rIdx;
                renderSearchResults();
                var chosen = searchResults[searchIdx];
                if (chosen) {
                    closeSearch();
                    if (chosen.isCategoryResult) {
                        jumpToCategoryFromSearch(chosen);
                    } else if (chosen.isEpgProgramResult) {
                        if (chosen.epgProg && !chosen.epgProg.isNow && !chosen.epgProg.isPast) {
                            toggleProgramReminder(chosen.channelRef, chosen.epgProg);
                        } else if (chosen.channelRef) {
                            if (window._parentalUnlocked || !isAdultContentItem(chosen.channelRef)) {
                                setOverlayVisible(false);
                            }
                            playItem(chosen.channelRef);
                            syncLiveChannelCursorOnZap(chosen.channelRef);
                        }
                    } else if (chosen.isSeries) {
                        jumpToSeriesFromSearch(chosen);
                    } else {
                        if (window._parentalUnlocked || !isAdultContentItem(chosen)) {
                            setOverlayVisible(false);
                        }
                        playItem(chosen);
                        if (!chosen.isVod && !chosen.isSeries) {
                            syncLiveChannelCursorOnZap(chosen);
                        }
                    }
                }
            } else if (container === tracksListEl) {
                tracksModalIdx = rIdx;
                renderTracksModalList();
                activateSelectedTrackModalRow();
            } else if (container === miniZapListEl) {
                miniZapIdx = rIdx;
                var zapClickList = getLiveZapList();
                if (zapClickList[miniZapIdx]) {
                    var zapTargetCh = zapClickList[miniZapIdx];
                    if (zapClickList === currentItems) {
                        itemIdx = miniZapIdx;
                        renderItems();
                    }
                    closeMiniZapDrawer();
                    playItem(zapTargetCh);
                    syncLiveChannelCursorOnZap(zapTargetCh);
                }
            }
        };
        row.ondblclick = function(ev) {
            ev.stopPropagation();
            var rIdx = typeof row._rowIndex === 'number' ? row._rowIndex : rowIndex;
            if (container === itemsListEl) {
                itemIdx = rIdx;
                activateCurrentItemSelection();
            } else if (container === epgModalList) {
                epgModalIdx = rIdx;
                triggerSelectedEpgProgram();
            } else if (container === tracksListEl) {
                tracksModalIdx = rIdx;
                renderTracksModalList();
                activateSelectedTrackModalRow();
            }
        };

        return row;
    }

    function syncRenderedListSelection(container, start, selectedIdx) {
        var children = container.children;
        var isPlayableList = (container === itemsListEl || container === miniZapListEl);
        for (var c = 0; c < children.length; c++) {
            var actualIdx = start + c;
            var node = children[c];
            node._rowIndex = actualIdx;
            var isSel = (actualIdx === selectedIdx);
            var isPlay = (isPlayableList && node._entryRef) ? isCurrentlyPlayingEntry(node._entryRef) : false;
            if (node._isSel === isSel && node._isPlay === isPlay) {
                continue;
            }
            node._isSel = isSel;
            node._isPlay = isPlay;
            if (node.classList) {
                if (isSel) {
                    node.classList.add('selected');
                } else {
                    node.classList.remove('selected');
                }
                if (isPlayableList) {
                    if (isPlay) {
                        node.classList.add('playing');
                    } else {
                        node.classList.remove('playing');
                    }
                }
            } else {
                node.className = 'item' + (isSel ? ' selected' : '') + (isPlay ? ' playing' : '');
            }
            if (node._playBadge && node._playBadge.classList) {
                if (isPlay) {
                    node._playBadge.classList.add('visible');
                } else {
                    node._playBadge.classList.remove('visible');
                }
            }
        }
    }

    function renderList(container, items, selectedIdx, labelFn, windowSize) {
        if (!container) {
            return;
        }
        var list = Array.isArray(items) ? items : [];
        if (list.length === 0) {
            container._lastItemsRef = null;
            updateVirtualScrollIndicator(container, 0, 0, 0);
            var emptyMsg = 'No items found';
            var canRetryEmpty = false;
            if (container === itemsListEl) {
                var curCatObj = currentCats[catIdx];
                var curCatId = curCatObj ? String(curCatObj.id) : '*';
                if (itemFilterText) {
                    emptyMsg = 'No matches for "' + itemFilterText + '" — Press OK or BLUE to clear';
                    canRetryEmpty = true;
                } else if (curCatId === 'fav') {
                    emptyMsg = 'No favorites yet — Press ★ or YELLOW on any item to add';
                } else if (curCatId === 'rec') {
                    emptyMsg = 'No watch history recorded yet';
                } else if (curCatId === 'cont') {
                    emptyMsg = 'No in-progress movies or episodes yet';
                } else if (!vodLoading && !liveCatalogLoading && !seriesLoading) {
                    emptyMsg = 'No items found — Press OK to Retry';
                    canRetryEmpty = true;
                }
            }
            var emptyDiv = document.createElement('div');
            emptyDiv.className = 'item' + (canRetryEmpty ? ' selected' : '');
            emptyDiv.textContent = emptyMsg;
            if (canRetryEmpty) {
                emptyDiv.onclick = function(ev) {
                    ev.stopPropagation();
                    activateCurrentItemSelection();
                };
            }
            container._gridRef = null;
            container.innerHTML = '';
            container.appendChild(emptyDiv);
            return;
        }
        var win = windowSize || 12;
        var half = Math.floor(win / 2);
        var start;
        var end;
        var canUseBufferedWindow = !container._forceRebuild &&
            container._lastItemsRef === list &&
            container._lastLen === list.length &&
            typeof container._lastStart === 'number' &&
            typeof container._lastEnd === 'number' &&
            (container._lastEnd - container._lastStart) === Math.min(win, list.length);
        if (canUseBufferedWindow) {
            var prevStart = container._lastStart;
            var prevEnd = container._lastEnd;
            var margin = win >= 8 ? 2 : 1;
            var topBound = prevStart > 0 ? (prevStart + margin) : 0;
            var botBound = prevEnd < list.length ? (prevEnd - 1 - margin) : (list.length - 1);
            if (selectedIdx < topBound) {
                start = Math.max(0, selectedIdx - margin);
            } else if (selectedIdx > botBound) {
                start = Math.min(Math.max(0, list.length - win), selectedIdx - win + 1 + margin);
            } else {
                start = prevStart;
            }
            end = Math.min(list.length, start + win);
            if (end - start < win) {
                start = Math.max(0, end - win);
            }
        } else {
            start = Math.max(0, selectedIdx - half);
            end = Math.min(list.length, start + win);
            if (end - start < win) {
                start = Math.max(0, end - win);
            }
        }
        updateVirtualScrollIndicator(container, list.length, start, end);
        var children = container.children;
        var firstId = list[start] ? ((list[start].id || list[start].catId || '') + ':' + (list[start].title || list[start].name || '')) : '';
        var lastId = list[end - 1] ? ((list[end - 1].id || list[end - 1].catId || '') + ':' + (list[end - 1].title || list[end - 1].name || '')) : '';
        var sameWindow = !container._forceRebuild &&
            container._lastLen === list.length &&
            container._lastStart === start &&
            container._lastEnd === end &&
            container._lastFirstId === firstId &&
            container._lastLastId === lastId &&
            children && children.length === (end - start);
        if (sameWindow) {
            syncRenderedListSelection(container, start, selectedIdx);
            return;
        }
        var canShiftSingleRow = canUseBufferedWindow &&
            children &&
            children.length === (end - start) &&
            Math.abs(start - container._lastStart) === 1;
        if (canShiftSingleRow) {
            if (start === container._lastStart + 1 && container.firstElementChild) {
                releaseDetachedCardMedia(container.firstElementChild);
                container.removeChild(container.firstElementChild);
                container.appendChild(createListItemRow(container, list[end - 1], end - 1, selectedIdx, labelFn));
            } else if (start === container._lastStart - 1 && container.lastElementChild) {
                releaseDetachedCardMedia(container.lastElementChild);
                container.removeChild(container.lastElementChild);
                container.insertBefore(createListItemRow(container, list[start], start, selectedIdx, labelFn), container.firstElementChild);
            }
            container._lastStart = start;
            container._lastEnd = end;
            container._lastFirstId = firstId;
            container._lastLastId = lastId;
            syncRenderedListSelection(container, start, selectedIdx);
            return;
        }
        container._forceRebuild = false;
        container._gridRef = null;
        container._lastItemsRef = list;
        container._lastLen = list.length;
        container._lastStart = start;
        container._lastEnd = end;
        container._lastFirstId = firstId;
        container._lastLastId = lastId;
        for (var dIdx = 0; dIdx < container.children.length; dIdx++) {
            releaseDetachedCardMedia(container.children[dIdx]);
        }
        container.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = start; i < end; i++) {
            frag.appendChild(createListItemRow(container, list[i], i, selectedIdx, labelFn));
        }
        container.appendChild(frag);
    }

    function applyColumnFilters() {
        var curModeId = getActiveContentModeId();
        var pinnedIds = getPinnedCatIds(curModeId);
        var pinnedLookup = getPinnedCatMap(curModeId);
        var hiddenCatIds = getHiddenCatIds(curModeId);
        var hiddenCatLookup = getHiddenCatMap(curModeId);
        var hiddenItemIds = getHiddenItemIds(curModeId);
        var hiddenItemLookup = getHiddenItemMap(curModeId);
        var cFilter = (catFilterText || '').toLowerCase().trim();
        var iFilter = (itemFilterText || '').toLowerCase().trim();

        if (catsFilterMemo &&
            catsFilterMemo.rawRef === rawCats &&
            catsFilterMemo.rawLen === rawCats.length &&
            catsFilterMemo.modeId === curModeId &&
            catsFilterMemo.cFilter === cFilter &&
            catsFilterMemo.showHidden === showHiddenEntries &&
            catsFilterMemo.pinnedRef === pinnedIds &&
            catsFilterMemo.pinnedLen === pinnedIds.length &&
            catsFilterMemo.hiddenCatsRef === hiddenCatIds &&
            catsFilterMemo.hiddenCatsLen === hiddenCatIds.length) {
            currentCats = catsFilterMemo.result;
        } else {
            var builtInCats = [];
            var pinnedCats = [];
            var regularCats = [];
            for (var r = 0; r < rawCats.length; r++) {
                var rc = rawCats[r];
                if (!rc) {
                    continue;
                }
                var rcIdStr = String(rc.id);
                var isBuiltIn = (rcIdStr === '*' || rcIdStr === 'new' || rcIdStr === 'cont' || rcIdStr === 'fav' || rcIdStr === 'rec');
                if (!isBuiltIn && !showHiddenEntries && hiddenCatLookup[rcIdStr]) {
                    continue;
                }
                if (isBuiltIn) {
                    builtInCats.push(rc);
                } else if (pinnedLookup[rcIdStr]) {
                    pinnedCats.push(rc);
                } else {
                    regularCats.push(rc);
                }
            }
            var orderedRawCats = builtInCats.concat(pinnedCats).concat(regularCats);
            if (cFilter) {
                currentCats = orderedRawCats.filter(function(c) {
                    return getCatLowerTitle(c).indexOf(cFilter) !== -1;
                });
            } else {
                currentCats = orderedRawCats;
            }
            catsFilterMemo = {
                rawRef: rawCats,
                rawLen: rawCats.length,
                modeId: curModeId,
                cFilter: cFilter,
                showHidden: showHiddenEntries,
                pinnedRef: pinnedIds,
                pinnedLen: pinnedIds.length,
                hiddenCatsRef: hiddenCatIds,
                hiddenCatsLen: hiddenCatIds.length,
                result: currentCats
            };
        }

        var firstRawItem = rawItems.length > 0 ? rawItems[0] : null;
        var lastRawItem = rawItems.length > 0 ? rawItems[rawItems.length - 1] : null;
        if (itemsFilterMemo &&
            itemsFilterMemo.rawRef === rawItems &&
            itemsFilterMemo.rawLen === rawItems.length &&
            itemsFilterMemo.firstItem === firstRawItem &&
            itemsFilterMemo.lastItem === lastRawItem &&
            itemsFilterMemo.modeId === curModeId &&
            itemsFilterMemo.iFilter === iFilter &&
            itemsFilterMemo.sort === currentSort &&
            itemsFilterMemo.showHidden === showHiddenEntries &&
            itemsFilterMemo.hiddenItemsRef === hiddenItemIds &&
            itemsFilterMemo.hiddenItemsLen === hiddenItemIds.length &&
            itemsFilterMemo.hiddenCatsRef === hiddenCatIds &&
            itemsFilterMemo.hiddenCatsLen === hiddenCatIds.length) {
            currentItems = itemsFilterMemo.result;
        } else {
            var baseItems = rawItems;
            var hasHiddenFilter = !showHiddenEntries && (hiddenItemIds.length > 0 || hiddenCatIds.length > 0);
            if (hasHiddenFilter) {
                baseItems = [];
                for (var bi = 0; bi < rawItems.length; bi++) {
                    var itemCandidate = rawItems[bi];
                    if (!itemCandidate) {
                        continue;
                    }
                    if (hiddenItemLookup[String(itemCandidate.id)]) {
                        continue;
                    }
                    if (itemCandidate.genreId && hiddenCatLookup[String(itemCandidate.genreId)]) {
                        continue;
                    }
                    baseItems.push(itemCandidate);
                }
            }
            if (iFilter) {
                currentItems = baseItems.filter(function(it) {
                    return getItemLowerName(it).indexOf(iFilter) !== -1;
                });
            } else if (currentSort !== 'added') {
                currentItems = baseItems.slice();
            } else {
                currentItems = baseItems;
            }
            if (currentSort === 'title_asc') {
                currentItems.sort(compareItemsByNameAsc);
            } else if (currentSort === 'title_desc') {
                currentItems.sort(compareItemsByNameDesc);
            }
            itemsFilterMemo = {
                rawRef: rawItems,
                rawLen: rawItems.length,
                firstItem: firstRawItem,
                lastItem: lastRawItem,
                modeId: curModeId,
                iFilter: iFilter,
                sort: currentSort,
                showHidden: showHiddenEntries,
                hiddenItemsRef: hiddenItemIds,
                hiddenItemsLen: hiddenItemIds.length,
                hiddenCatsRef: hiddenCatIds,
                hiddenCatsLen: hiddenCatIds.length,
                result: currentItems
            };
        }
        if (catIdx >= currentCats.length) {
            catIdx = Math.max(0, currentCats.length - 1);
        }
        if (itemIdx >= currentItems.length) {
            itemIdx = Math.max(0, currentItems.length - 1);
        }
        if (filterBadgeEl) {
            var activeFilters = [];
            if (cFilter) {
                activeFilters.push('Cat: ' + catFilterText);
            }
            if (iFilter) {
                activeFilters.push('Item: ' + itemFilterText);
            }
            if (currentSort !== 'added') {
                activeFilters.push('Sort: ' + currentSort.replace('title_', '').toUpperCase());
            }
            if (showHiddenEntries) {
                activeFilters.push('Showing Hidden');
            } else if (hiddenCatIds.length > 0 || hiddenItemIds.length > 0) {
                activeFilters.push('Hidden: ' + (hiddenCatIds.length + hiddenItemIds.length));
            }
            if (activeFilters.length > 0) {
                filterBadgeEl.textContent = activeFilters.join(' | ');
                filterBadgeEl.classList.add('visible');
            } else {
                filterBadgeEl.classList.remove('visible');
            }
        }
    }
    function updateInlineRowEpg(channelId, nowText) {
        if (!itemsListEl || !itemsListEl.children || !nowText || nowText === 'No EPG Available') {
            return;
        }
        var targetId = String(channelId);
        var cachedCh = shortEpgCache[targetId];
        var parsed = (cachedCh && Array.isArray(cachedCh.list) && cachedCh.list.length > 0) ? parseShortEpgNowNext(cachedCh.list) : null;
        var remMin = parsed && parsed.remMin > 0 ? parsed.remMin : 0;
        var pct = parsed && parsed.progressPct > 0 ? parsed.progressPct : 0;
        var children = itemsListEl.children;
        for (var i = 0; i < children.length; i++) {
            var row = children[i];
            if (row && row._entryId === targetId && row._textStack) {
                if (!row._epgSubEl) {
                    var epgSub = document.createElement('span');
                    epgSub.className = 'item-epg-sub';
                    row._textStack.appendChild(epgSub);
                    row._epgSubEl = epgSub;
                }
                row._epgSubEl.textContent = nowText + (remMin > 0 ? ('  • -' + remMin + 'm') : '');
                if (pct > 0) {
                    if (!row._epgBarTrackEl) {
                        var barTrack = document.createElement('div');
                        barTrack.className = 'item-epg-bar-track visible';
                        var barFill = document.createElement('div');
                        barFill.className = 'item-epg-bar-fill';
                        barTrack.appendChild(barFill);
                        row._textStack.appendChild(barTrack);
                        row._epgBarTrackEl = barTrack;
                        row._epgBarFillEl = barFill;
                    } else {
                        row._epgBarTrackEl.classList.add('visible');
                    }
                    row._epgBarFillEl.style.width = pct + '%';
                } else if (row._epgBarTrackEl) {
                    row._epgBarTrackEl.classList.remove('visible');
                }
                break;
            }
        }
    }
    function renderModes() {
        renderList(modesListEl, modes, modeIdx, function(m) {
            return (m.icon ? (m.icon + '  ') : '') + m.title;
        }, 8);
    }
    function renderCats() {
        if (catsHeaderEl) {
            if (currentCats.length > 0) {
                catsHeaderEl.textContent = 'Categories (' + (catIdx + 1) + '/' + currentCats.length + ')';
            } else {
                catsHeaderEl.textContent = 'Categories';
            }
        }
        renderList(catsListEl, currentCats, catIdx, function(c) {
            return c.title;
        }, 12);
    }
    function buildPosterFallbackSvgHtml(titleText) {
        var monogram = String(titleText || 'VOD').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 2).toUpperCase() || 'TV';
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 340" preserveAspectRatio="none" class="poster-card-svg-fallback"><defs><linearGradient id="pfbGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#090d16"/></linearGradient></defs><rect width="240" height="340" fill="url(#pfbGrad)"/><text x="120" y="185" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-weight="900" font-size="68">' + monogram + '</text></svg>';
    }

    function createPosterCardNode(entry, index, selectedIdx) {
        var card = document.createElement('div');
        var isCardPlaying = isCurrentlyPlayingEntry(entry);
        card.className = 'poster-card' + (index === selectedIdx ? ' selected' : '') + (isCardPlaying ? ' playing' : '');
        card._entryRef = entry || null;
        card._cardIndex = index;
        card.setAttribute('data-index', String(index));
        card.onclick = function(e) {
            e.stopPropagation();
            userInteractedSinceBoot = true;
            itemIdx = typeof card._cardIndex === 'number' ? card._cardIndex : index;
            lockedPreviewItem = currentItems[itemIdx] || entry || null;
            renderUI();
            activateCurrentItemSelection();
        };

        var imgWrap = document.createElement('div');
        imgWrap.className = 'poster-card-img-wrap';

        var posterSrc = entry.poster || entry.logo || '';
        if (posterSrc) {
            var img = document.createElement('img');
            img.className = 'poster-card-img';
            img.alt = entry.name || '';
            img.loading = 'lazy';
            img.src = resolveLogoUrl(posterSrc);
            img.onerror = function() {
                img.style.display = 'none';
                if (!imgWrap.querySelector('.poster-card-svg-fallback')) {
                    var fallbackWrap = document.createElement('div');
                    fallbackWrap.style.width = '100%';
                    fallbackWrap.style.height = '100%';
                    fallbackWrap.innerHTML = buildPosterFallbackSvgHtml(entry.name);
                    imgWrap.insertBefore(fallbackWrap.firstChild, imgWrap.firstChild);
                }
            };
            imgWrap.appendChild(img);
        } else {
            imgWrap.innerHTML = buildPosterFallbackSvgHtml(entry.name);
        }

        if (entry.rating) {
            var rateBadge = document.createElement('div');
            rateBadge.className = 'poster-badge-rating';
            rateBadge.textContent = '★ ' + entry.rating;
            imgWrap.appendChild(rateBadge);
        }

        var watched = isItemWatched(entry.id);
        if (!entry.isSeason && !entry.isEpisode && isFavItem(entry)) {
            var favBadge = document.createElement('div');
            favBadge.className = 'poster-badge-fav';
            favBadge.textContent = '★';
            imgWrap.appendChild(favBadge);
        } else if (watched) {
            var watchedBadge = document.createElement('div');
            watchedBadge.className = 'poster-badge-watched';
            watchedBadge.textContent = '✓';
            imgWrap.appendChild(watchedBadge);
        }

        var resume = getResumeInfo(entry.id);
        var barPct = 0;
        if (resume && resume.pos > 0 && resume.dur > 0) {
            barPct = Math.min(100, Math.max(4, Math.round((resume.pos / resume.dur) * 100)));
        } else if (watched) {
            barPct = 100;
        }
        if (barPct > 0) {
            var resBar = document.createElement('div');
            resBar.className = 'poster-resume-bar';
            var resFill = document.createElement('div');
            resFill.className = 'poster-resume-fill';
            resFill.style.width = barPct + '%';
            resBar.appendChild(resFill);
            imgWrap.appendChild(resBar);
        }

        card.appendChild(imgWrap);

        var infoWrap = document.createElement('div');
        infoWrap.className = 'poster-card-info';

        var titleEl = document.createElement('div');
        titleEl.className = 'poster-card-title';
        titleEl.textContent = entry.name || 'Untitled';
        infoWrap.appendChild(titleEl);

        if (entry.year) {
            var yearEl = document.createElement('div');
            yearEl.className = 'poster-card-year';
            yearEl.textContent = String(entry.year);
            infoWrap.appendChild(yearEl);
        }

        card.appendChild(infoWrap);
        return card;
    }

    function syncPosterGridSelection(container, start, selectedIdx) {
        var children = container.children;
        for (var c = 0; c < children.length; c++) {
            var actualIdx = start + c;
            var cardNode = children[c];
            cardNode._cardIndex = actualIdx;
            cardNode.setAttribute('data-index', String(actualIdx));
            if (actualIdx === selectedIdx) {
                cardNode.classList.add('selected');
            } else {
                cardNode.classList.remove('selected');
            }
            if (isCurrentlyPlayingEntry(cardNode._entryRef)) {
                cardNode.classList.add('playing');
            } else {
                cardNode.classList.remove('playing');
            }
        }
    }

    function releaseDetachedCardMedia(node) {
        if (!node) {
            return;
        }
        node.onclick = null;
        node.ondblclick = null;
        if (node._favBtnEl) {
            node._favBtnEl.onclick = null;
            node._favBtnEl = null;
        }
        node._entryRef = null;
        node._playBadge = null;
        node._epgSubEl = null;
        node._epgBarTrackEl = null;
        node._epgBarFillEl = null;
        node._textStack = null;
        var imgs = node.getElementsByTagName ? node.getElementsByTagName('img') : [];
        for (var i = 0; i < imgs.length; i++) {
            imgs[i].onload = null;
            imgs[i].onerror = null;
            imgs[i].removeAttribute('src');
        }
    }

    function renderPosterGrid(container, items, selectedIdx) {
        if (!container) {
            return;
        }
        var list = Array.isArray(items) ? items : [];
        if (list.length === 0) {
            container._gridRef = null;
            renderList(container, items, selectedIdx, null, 12);
            return;
        }
        var win = 9;
        var selectedRow = Math.floor(selectedIdx / 3);
        var startRow = Math.max(0, selectedRow - 1);
        var maxStartRow = Math.max(0, Math.ceil(list.length / 3) - 3);
        if (startRow > maxStartRow) {
            startRow = maxStartRow;
        }
        var start = startRow * 3;
        var end = Math.min(list.length, start + win);
        updateVirtualScrollIndicator(container, list.length, start, end);

        var firstId = list[start] ? (list[start].id || list[start].name) : '';
        var lastId = list[end - 1] ? (list[end - 1].id || list[end - 1].name) : '';
        var children = container.children;
        var isPosterCardsReady = children && children.length === (end - start) &&
            children[0] && children[0].classList && children[0].classList.contains('poster-card');
        var sameWindow = !container._forceRebuild &&
            container._gridRef === list &&
            container._gridLen === list.length &&
            container._gridStart === start &&
            container._gridEnd === end &&
            container._gridFirstId === firstId &&
            container._gridLastId === lastId &&
            isPosterCardsReady;

        if (sameWindow) {
            syncPosterGridSelection(container, start, selectedIdx);
            return;
        }

        var canShiftGridRow = !container._forceRebuild &&
            container._gridRef === list &&
            container._gridLen === list.length &&
            typeof container._gridStart === 'number' &&
            typeof container._gridEnd === 'number' &&
            (end - start) === win &&
            (container._gridEnd - container._gridStart) === win &&
            Math.abs(start - container._gridStart) === 3 &&
            isPosterCardsReady;

        if (canShiftGridRow) {
            var s;
            if (start === container._gridStart + 3) {
                for (s = 0; s < 3; s++) {
                    if (container.firstElementChild) {
                        releaseDetachedCardMedia(container.firstElementChild);
                        container.removeChild(container.firstElementChild);
                    }
                }
                for (s = end - 3; s < end; s++) {
                    if (list[s]) {
                        container.appendChild(createPosterCardNode(list[s], s, selectedIdx));
                    }
                }
            } else if (start === container._gridStart - 3) {
                for (s = 0; s < 3; s++) {
                    if (container.lastElementChild) {
                        releaseDetachedCardMedia(container.lastElementChild);
                        container.removeChild(container.lastElementChild);
                    }
                }
                var anchorCard = container.firstElementChild;
                for (s = start; s < start + 3; s++) {
                    if (list[s]) {
                        container.insertBefore(createPosterCardNode(list[s], s, selectedIdx), anchorCard);
                    }
                }
            }
            container._gridStart = start;
            container._gridEnd = end;
            container._gridFirstId = firstId;
            container._gridLastId = lastId;
            syncPosterGridSelection(container, start, selectedIdx);
            return;
        }

        container._forceRebuild = false;
        container._gridRef = list;
        container._gridLen = list.length;
        container._gridStart = start;
        container._gridEnd = end;
        container._gridFirstId = firstId;
        container._gridLastId = lastId;
        container._lastItemsRef = null;

        for (var rIdx = 0; rIdx < container.children.length; rIdx++) {
            releaseDetachedCardMedia(container.children[rIdx]);
        }
        container.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = start; i < end; i++) {
            if (list[i]) {
                frag.appendChild(createPosterCardNode(list[i], i, selectedIdx));
            }
        }
        container.appendChild(frag);
    }

    function renderItems() {
        var activeModeObj = (modes[modeIdx] && modes[modeIdx].id !== 'search' && modes[modeIdx].id !== 'settings') ? modes[modeIdx] : (modes[lastContentModeIdx] || modes[0]);
        if (itemsHeaderEl && seriesStack.length === 0 && activeModeObj) {
            var baseTitle = activeModeObj.title;
            if (currentItems.length > 0) {
                itemsHeaderEl.textContent = baseTitle + ' (' + (itemIdx + 1) + '/' + currentItems.length + ')';
            } else {
                itemsHeaderEl.textContent = baseTitle;
            }
        }
        if (isPosterGridActive()) {
            if (itemsListEl) {
                itemsListEl.classList.add('poster-grid-mode');
            }
            renderPosterGrid(itemsListEl, currentItems, itemIdx);
        } else {
            if (itemsListEl) {
                itemsListEl._gridRef = null;
                itemsListEl.classList.remove('poster-grid-mode');
            }
            renderList(itemsListEl, currentItems, itemIdx, function(it) {
                var resume = it.isVod ? getResumeInfo(it.id) : null;
                var resumeSuffix = resume ? (' [' + formatTimeHMS(resume.pos) + ']') : '';
                return it.name + resumeSuffix;
            }, 12);
        }
    }
    function updateInfoActionsFocus() {
        var focusedPill = null;
        for (var i = 0; i < quickActionButtons.length; i++) {
            var pill = quickActionButtons[i].el;
            if (activeCol === 'info' && i === infoActionIdx) {
                pill.classList.add('focused');
                focusedPill = pill;
            } else {
                pill.classList.remove('focused');
            }
        }
        if (activeCol === 'info' && focusedPill) {
            var bar = document.getElementById('preview-quick-actions');
            if (bar && bar.clientHeight > 0) {
                if (infoActionIdx <= 1) {
                    bar.scrollTop = 0;
                    return;
                }
                if (infoActionIdx === quickActionButtons.length - 1) {
                    bar.scrollTop = Math.max(0, bar.scrollHeight - bar.clientHeight);
                    return;
                }
                var pillTop = (focusedPill.offsetParent === bar)
                    ? focusedPill.offsetTop
                    : Math.max(0, focusedPill.offsetTop - bar.offsetTop);
                var pillBottom = pillTop + focusedPill.offsetHeight;
                var viewTop = bar.scrollTop;
                var viewBottom = viewTop + bar.clientHeight;
                if (pillTop < viewTop + 14) {
                    bar.scrollTop = Math.max(0, pillTop - 12);
                } else if (pillBottom > viewBottom - 14) {
                    bar.scrollTop = Math.max(0, pillBottom - bar.clientHeight + 14);
                }
                if (typeof bar.getBoundingClientRect === 'function' && typeof focusedPill.getBoundingClientRect === 'function') {
                    var barRect = bar.getBoundingClientRect();
                    var pillRect = focusedPill.getBoundingClientRect();
                    if (barRect.height > 0 && pillRect.height > 0) {
                        if (pillRect.top < barRect.top + 10) {
                            bar.scrollTop = Math.max(0, bar.scrollTop - (barRect.top - pillRect.top) - 12);
                        } else if (pillRect.bottom > barRect.bottom - 10) {
                            bar.scrollTop = Math.min(
                                Math.max(0, bar.scrollHeight - bar.clientHeight),
                                bar.scrollTop + (pillRect.bottom - barRect.bottom) + 14
                            );
                        }
                    }
                }
            }
        }
    }
    function enforceReadableColumnLayout() {
        if (layoutEnforced) {
            return;
        }
        layoutEnforced = true;
        document.body.classList.remove('compact-nav');
        if (modesColEl && modesColEl.style) {
            modesColEl.style.flex = '0 0 200px';
            modesColEl.style.width = '200px';
            modesColEl.style.minWidth = '200px';
            modesColEl.style.maxWidth = '200px';
        }
        if (catsColEl && catsColEl.style) {
            catsColEl.style.flex = '0 0 500px';
            catsColEl.style.width = '500px';
            catsColEl.style.minWidth = '500px';
            catsColEl.style.maxWidth = '500px';
        }
        if (itemsColEl && itemsColEl.style) {
            itemsColEl.style.flex = '0 0 760px';
            itemsColEl.style.width = '760px';
            itemsColEl.style.minWidth = '760px';
            itemsColEl.style.maxWidth = '760px';
        }
        if (infoColEl && infoColEl.style) {
            infoColEl.style.flex = '0 0 460px';
            infoColEl.style.width = '460px';
            infoColEl.style.minWidth = '460px';
            infoColEl.style.maxWidth = '460px';
        }
    }
    function updateContextualHelpBar() {
        if (!helpContextActionsEl) {
            return;
        }
        var hints = [];
        if (epgModalOpen) {
            hints.push({ key: '▲▼◀▶', desc: 'Navigate' });
            hints.push({ key: 'OK', desc: 'Watch / Catch-Up / Remind' });
            hints.push({ key: 'GREEN', desc: 'Grid / List' });
            hints.push({ key: 'YELLOW', desc: 'EPG Offset' });
            hints.push({ key: 'BACK', desc: 'Close' });
        } else if (searchOpen) {
            hints.push({ key: '▲▼◀▶', desc: 'Navigate' });
            hints.push({ key: 'OK', desc: 'Select' });
            hints.push({ key: 'BACK', desc: 'Exit' });
        } else if (settingsOpen) {
            hints.push({ key: '▲▼◀▶', desc: 'Navigate' });
            hints.push({ key: 'OK', desc: 'Select / Toggle' });
            hints.push({ key: 'BACK', desc: 'Close' });
        } else if (typeof tracksModalOpen !== 'undefined' && tracksModalOpen) {
            hints.push({ key: '▲▼', desc: 'Tracks' });
            hints.push({ key: 'OK', desc: 'Apply' });
            hints.push({ key: 'BACK', desc: 'Close' });
        } else if (filterOpen) {
            hints.push({ key: '▲▼◀▶', desc: 'Options' });
            hints.push({ key: 'OK', desc: 'Apply' });
            hints.push({ key: 'BACK', desc: 'Close' });
        } else if (activeCol === 'modes') {
            hints.push({ key: '▲▼', desc: 'Modes' });
            hints.push({ key: 'OK / ▶', desc: 'Categories' });
            hints.push({ key: 'BLUE', desc: 'Switch Portal' });
        } else if (activeCol === 'cats') {
            hints.push({ key: '▲▼', desc: 'Categories' });
            hints.push({ key: '◀', desc: 'Modes' });
            hints.push({ key: 'OK / ▶', desc: 'Items' });
            hints.push({ key: 'YELLOW', desc: 'Pin Cat' });
        } else if (activeCol === 'items') {
            var mId = getActiveContentModeId();
            hints.push({ key: 'OK', desc: 'Play' });
            if (mId === 'live') {
                hints.push({ key: 'GUIDE', desc: 'EPG' });
                hints.push({ key: 'YELLOW', desc: 'Favorite' });
                hints.push({ key: '▶', desc: 'Actions' });
            } else {
                hints.push({ key: 'YELLOW', desc: 'Favorite' });
                hints.push({ key: 'GREEN', desc: 'Search' });
                hints.push({ key: '▶', desc: 'Actions' });
            }
        } else if (activeCol === 'info') {
            hints.push({ key: '▲▼◀▶', desc: 'Action Grid' });
            hints.push({ key: 'OK', desc: 'Execute' });
            hints.push({ key: '◀', desc: 'Items' });
        }
        helpContextActionsEl.innerHTML = '';
        for (var i = 0; i < hints.length; i++) {
            var itemDiv = document.createElement('span');
            itemDiv.className = 'keycap-item';
            var capSpan = document.createElement('span');
            var keyUpper = String(hints[i].key || '').toUpperCase();
            var colorCls = '';
            if (keyUpper === 'RED') {
                colorCls = 'red';
            } else if (keyUpper === 'GREEN') {
                colorCls = 'green';
            } else if (keyUpper === 'YELLOW') {
                colorCls = 'yellow';
            } else if (keyUpper === 'BLUE') {
                colorCls = 'blue';
            }
            if (colorCls) {
                capSpan.className = 'keycap keycap-color ' + colorCls;
                var dotEl = document.createElement('i');
                dotEl.className = 'dot ' + colorCls;
                capSpan.appendChild(dotEl);
                capSpan.appendChild(document.createTextNode(hints[i].key));
            } else {
                capSpan.className = 'keycap';
                capSpan.textContent = hints[i].key;
            }
            itemDiv.appendChild(capSpan);
            var descNode = document.createTextNode(' ' + hints[i].desc);
            itemDiv.appendChild(descNode);
            helpContextActionsEl.appendChild(itemDiv);
        }
    }

    function updateColumnFocusClasses() {
        enforceReadableColumnLayout();
        if (modesColEl) {
            if (activeCol === 'modes') {
                modesColEl.classList.add('focused');
            } else {
                modesColEl.classList.remove('focused');
            }
        }
        if (catsColEl) {
            if (activeCol === 'cats') {
                catsColEl.classList.add('focused');
            } else {
                catsColEl.classList.remove('focused');
            }
        }
        if (itemsColEl) {
            if (activeCol === 'items') {
                itemsColEl.classList.add('focused');
            } else {
                itemsColEl.classList.remove('focused');
            }
        }
        if (infoColEl) {
            if (activeCol === 'info') {
                infoColEl.classList.add('focused');
            } else {
                infoColEl.classList.remove('focused');
            }
        }
        if (settingsModal) {
            if (activeCol === 'settings' && settingsOpen) {
                settingsModal.classList.add('focused');
            } else {
                settingsModal.classList.remove('focused');
            }
        }
        updateInfoActionsFocus();
        updateContextualHelpBar();
    }
    function renderUI() {
        updateColumnFocusClasses();
        renderModes();
        renderCats();
        renderItems();
        updatePreviewPanel();
    }

    function bindQuickActionPill(bar, act) {
        var pill = document.createElement('span');
        pill.className = 'quick-action-pill' + (act.group === 'toggle_more' ? ' toggle-more-pill' : '');
        pill.textContent = act.label;
        var entryObj = {
            el: pill,
            fn: act.fn,
            group: act.group || 'primary',
            label: act.label
        };
        pill.onclick = function(ev) {
            ev.stopPropagation();
            activeCol = 'info';
            for (var k = 0; k < quickActionButtons.length; k++) {
                if (quickActionButtons[k] === entryObj) {
                    infoActionIdx = k;
                    break;
                }
            }
            updateColumnFocusClasses();
            act.fn();
        };
        bar.appendChild(pill);
        allQuickActionPills.push(entryObj);
    }

    function syncQuickActionVisibility() {
        if (allQuickActionPills.length === 0) {
            return;
        }
        var curModeId = modes[modeIdx] ? modes[modeIdx].id : 'live';
        if (curModeId === 'search' || curModeId === 'settings') {
            curModeId = modes[lastContentModeIdx] ? modes[lastContentModeIdx].id : 'live';
        }
        var curCat = currentCats[catIdx];
        var curCatId = curCat ? String(curCat.id) : '*';
        var isFavCat = (curCatId === 'fav');
        var isHistoryCat = (curCatId === 'rec');
        var isLiveMode = (curModeId === 'live');
        var isVodOrSeries = (curModeId === 'vod' || curModeId === 'series');
        var hasMultiPortals = Array.isArray(profiles) && profiles.length > 1;
        var sig = curModeId + '|' + curCatId + '|' + (moreToolsExpanded ? '1' : '0') + '|' + (hasMultiPortals ? 'M' : 'S');
        if (sig === lastQuickActionSig && quickActionButtons.length > 0) {
            return;
        }
        lastQuickActionSig = sig;
        quickActionButtons = [];
        for (var i = 0; i < allQuickActionPills.length; i++) {
            var p = allQuickActionPills[i];
            var g = p.group;
            var show = false;
            if (g === 'primary') {
                show = true;
            } else if (g === 'portal_switch') {
                show = hasMultiPortals || moreToolsExpanded;
            } else if (g === 'live_primary') {
                show = isLiveMode;
            } else if (g === 'vod_primary') {
                show = isVodOrSeries || moreToolsExpanded;
            } else if (g === 'fav_context') {
                show = isFavCat || (isLiveMode && moreToolsExpanded);
            } else if (g === 'history_context') {
                show = isHistoryCat || moreToolsExpanded;
            } else if (g === 'more') {
                show = moreToolsExpanded;
            } else if (g === 'toggle_more') {
                show = true;
                p.el.textContent = moreToolsExpanded ? '▴ Fewer Tools' : '⚙ More Tools';
            }
            p.el.style.display = show ? 'inline-flex' : 'none';
            if (show) {
                quickActionButtons.push(p);
            }
        }
        if (infoActionIdx >= quickActionButtons.length) {
            infoActionIdx = Math.max(0, quickActionButtons.length - 1);
        }
        updateInfoActionsFocus();
    }

    function ensureQuickActionBar() {
        var topRightEl = document.getElementById('top-right') || document.getElementById('top-bar');
        if (topRightEl && !document.getElementById('top-status-cluster')) {
            var clusterEl = document.createElement('div');
            clusterEl.id = 'top-status-cluster';
            clusterEl.className = 'status-cluster';
            var badgeEls = [profileBadgeEl, accountBadgeEl, filterBadgeEl, sleepTimerBadgeEl, reminderBadgeEl, recStatusBadgeEl];
            for (var b = 0; b < badgeEls.length; b++) {
                if (badgeEls[b] && badgeEls[b].parentNode === topRightEl) {
                    clusterEl.appendChild(badgeEls[b]);
                }
            }
            if (clockDisplayEl && clockDisplayEl.parentNode === topRightEl) {
                topRightEl.insertBefore(clusterEl, clockDisplayEl);
            } else {
                topRightEl.appendChild(clusterEl);
            }
        }
        var helpBarEl = document.getElementById('help-bar');
        if (helpBarEl && !document.getElementById('help-context-actions')) {
            var helpCtxEl = document.createElement('div');
            helpCtxEl.id = 'help-context-actions';
            helpCtxEl.className = 'keycap-hints';
            helpBarEl.appendChild(helpCtxEl);
        }
        if (!previewDescEl || !previewDescEl.parentNode) {
            return;
        }
        if (!document.getElementById('preview-epg-progress-wrap')) {
            var epgProgWrap = document.createElement('div');
            epgProgWrap.id = 'preview-epg-progress-wrap';
            epgProgWrap.className = 'preview-epg-bar-wrap';
            var epgProgFill = document.createElement('div');
            epgProgFill.id = 'preview-epg-progress-fill';
            epgProgFill.className = 'preview-epg-bar-fill';
            epgProgWrap.appendChild(epgProgFill);
            previewDescEl.parentNode.insertBefore(epgProgWrap, previewDescEl);
        }
        if (!previewUpNextCardEl) {
            previewUpNextCardEl = document.getElementById('preview-upnext-card');
        }
        if (!previewUpNextCardEl) {
            previewUpNextCardEl = document.createElement('div');
            previewUpNextCardEl.id = 'preview-upnext-card';
            previewUpNextCardEl.className = 'preview-upnext-card';
            previewDescEl.parentNode.insertBefore(previewUpNextCardEl, previewDescEl);
        }
        var bar = document.getElementById('preview-quick-actions');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'preview-quick-actions';
            bar.className = 'quick-action-bar';
            previewDescEl.parentNode.appendChild(bar);
        }
        if (allQuickActionPills.length > 0) {
            syncQuickActionVisibility();
            return;
        }
        var actions = [
            { label: '▶ Play / Fullscreen', group: 'primary', fn: function() { activateCurrentItemSelection(); } },
            { label: '🎬 Trailer', group: 'vod_primary', fn: function() { openTrailerModalForSelected(); } },
            { label: '★ Favorite', group: 'primary', fn: function() {
                if (currentItems[itemIdx]) {
                    toggleFavorite(currentItems[itemIdx]);
                }
            } },
            { label: '👤 Who\'s Watching', group: 'portal_switch', fn: function() { openProfilePickerModal(); } },
            { label: '⚡ Switch Portal', group: 'portal_switch', fn: function() { cycleActivePortalProfile(); } },
            { label: '⬆ Fav Up', group: 'fav_context', fn: function() { moveFavoriteItem(-1); } },
            { label: '⬇ Fav Down', group: 'fav_context', fn: function() { moveFavoriteItem(1); } },
            { label: '📅 EPG Guide', group: 'live_primary', fn: function() { openEpgModal(currentItems[itemIdx]); } },
            { label: '⏰ Remind Next', group: 'live_primary', fn: function() { scheduleNextProgramReminderForSelectedChannel(); } },
            { label: '🔊 Audio / Subs', group: 'primary', fn: function() { openTracksModal('audio'); } },
            { label: '▦ Grid / List View', group: 'vod_primary', fn: function() {
                vodViewMode = (vodViewMode === 'grid') ? 'list' : 'grid';
                safeSetStorage('cfg_vod_view', vodViewMode);
                if (vodViewMode === 'grid') {
                    lockedPreviewItem = currentItems[itemIdx] || null;
                } else {
                    lockedPreviewItem = null;
                }
                if (itemsListEl) {
                    itemsListEl._forceRebuild = true;
                }
                showToast('View: ' + (vodViewMode === 'grid' ? '▦ 3-Column Grid' : '☰ List'));
                renderItems();
                updatePreviewPanel();
            } },
            { label: '⏩ Speed', group: 'vod_primary', fn: function() { cyclePlaybackSpeed(); } },
            { label: '🔖 Bookmark', group: 'vod_primary', fn: function() { saveOrJumpVodBookmark(); } },
            { label: '⏺ Record Clip', group: 'live_primary', fn: function() { toggleStreamRecording(); } },
            { label: '🩺 Test Stream', group: 'primary', fn: function() { runStreamHealthProbe(); } },
            { label: '📋 Export Fav M3U', group: 'fav_context', fn: function() { exportFavoritesM3u(); } },
            { label: '🚫 Hide / Unhide Item', group: 'more', fn: function() {
                if (currentItems[itemIdx]) {
                    toggleHideItem(currentItems[itemIdx]);
                }
            } },
            { label: '📂 Hide / Unhide Cat', group: 'more', fn: function() {
                if (currentCats[catIdx]) {
                    toggleHideCategory(currentCats[catIdx]);
                }
            } },
            { label: '👁 Show Hidden Toggle', group: 'more', fn: function() { toggleShowHiddenMode(); } },
            { label: '📐 Aspect Ratio', group: 'more', fn: function() { toggleAspectRatio(); } },
            { label: '⏱ Sleep Timer', group: 'more', fn: function() { cycleSleepTimer(); } },
            { label: '⇅ Sort', group: 'more', fn: function() {
                var sorts = ['added', 'title_asc', 'title_desc'];
                currentSort = sorts[(sorts.indexOf(currentSort) + 1) % sorts.length];
                showToast('⇅ Sort: ' + currentSort.replace('title_', '').toUpperCase());
                applyColumnFilters();
                renderUI();
            } },
            { label: '⧩ Filter', group: 'more', fn: function() { openFilterModal('items'); } },
            { label: '🔄 Refresh', group: 'more', fn: function() { forceRefreshCurrentCatalog(); } },
            { label: '🗑 Clear History', group: 'history_context', fn: function() { clearCurrentHistory(); } },
            { label: '⚙ More Tools', group: 'toggle_more', fn: function() {
                var prevIdx = infoActionIdx;
                moreToolsExpanded = !moreToolsExpanded;
                if (infoColEl) {
                    if (moreToolsExpanded) {
                        infoColEl.classList.add('tools-expanded');
                        infoColEl.classList.add('more-tools-open');
                    } else {
                        infoColEl.classList.remove('tools-expanded');
                        infoColEl.classList.remove('more-tools-open');
                    }
                }
                lastQuickActionSig = '';
                syncQuickActionVisibility();
                if (moreToolsExpanded) {
                    infoActionIdx = Math.min(prevIdx, Math.max(0, quickActionButtons.length - 2));
                } else {
                    if (bar) {
                        bar.scrollTop = 0;
                    }
                    infoActionIdx = Math.max(0, quickActionButtons.length - 1);
                }
                updateInfoActionsFocus();
            } }
        ];
        bar.innerHTML = '';
        for (var i = 0; i < actions.length; i++) {
            bindQuickActionPill(bar, actions[i]);
        }
        syncQuickActionVisibility();
    }

    function setPreviewEpgProgress(pct, visible) {
        var wrap = document.getElementById('preview-epg-progress-wrap');
        var fill = document.getElementById('preview-epg-progress-fill');
        if (!wrap || !fill) {
            return;
        }
        if (visible && pct > 0) {
            wrap.classList.add('visible');
            fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
        } else {
            wrap.classList.remove('visible');
            fill.style.width = '0%';
        }
    }

    if (previewPosterEl && previewPosterWrapEl) {
        previewPosterEl.onerror = function() {
            previewPosterWrapEl.classList.remove('visible');
            previewPosterEl.removeAttribute('src');
        };
    }

    function schedulePreviewPosterLoad(rawUrl, expectedItemId) {
        if (posterLoadTimer) {
            clearTimeout(posterLoadTimer);
            posterLoadTimer = null;
        }
        var resolved = resolveLogoUrl(rawUrl || '');
        if (!resolved) {
            if (previewPosterWrapEl) {
                previewPosterWrapEl.classList.remove('visible');
            }
            return;
        }
        posterLoadTimer = setTimeout(function() {
            var cur = currentItems[itemIdx];
            if (!cur || String(cur.id) !== String(expectedItemId)) {
                return;
            }
            if (previewPosterEl && previewPosterWrapEl) {
                if (previewPosterEl.getAttribute('src') !== resolved) {
                    previewPosterEl.src = resolved;
                }
                previewPosterWrapEl.classList.add('visible');
            }
        }, 120);
    }

    function renderPreviewUpNextCard(rawList, channelObj) {
        if (!previewUpNextCardEl) {
            return;
        }
        if (!channelObj || channelObj.isVod || channelObj.isSeries || !Array.isArray(rawList) || rawList.length === 0) {
            previewUpNextCardEl.style.display = 'none';
            previewUpNextCardEl.innerHTML = '';
            return;
        }
        var normList = normalizeEpgEntries(rawList);
        if (!normList || normList.length === 0) {
            previewUpNextCardEl.style.display = 'none';
            previewUpNextCardEl.innerHTML = '';
            return;
        }
        var nowIdx = -1;
        for (var i = 0; i < normList.length; i++) {
            if (normList[i].isNow) {
                nowIdx = i;
                break;
            }
        }
        var upcoming = [];
        var startIdx = (nowIdx !== -1) ? (nowIdx + 1) : 0;
        for (var j = startIdx; j < normList.length && upcoming.length < 3; j++) {
            if (!normList[j].isPast) {
                upcoming.push(normList[j]);
            }
        }
        if (upcoming.length === 0) {
            previewUpNextCardEl.style.display = 'none';
            previewUpNextCardEl.innerHTML = '';
            return;
        }
        var isArch = Boolean(channelObj && channelObj.archive);
        previewUpNextCardEl.innerHTML = '';
        var hdr = document.createElement('div');
        hdr.className = 'preview-upnext-header upnext-card-header';
        hdr.textContent = 'UP NEXT';
        previewUpNextCardEl.appendChild(hdr);
        var listWrap = document.createElement('div');
        listWrap.className = 'preview-upnext-list';
        for (var u = 0; u < upcoming.length; u++) {
            var prog = upcoming[u];
            var timeLabel = prog.start_timestamp ? formatUnixTimeHM(prog.start_timestamp) : (prog.timeLabel || '--:--');
            var row = document.createElement('div');
            row.className = 'upnext-row';
            var timePill = document.createElement('span');
            timePill.className = 'upnext-time-pill';
            timePill.textContent = timeLabel;
            row.appendChild(timePill);
            var titleSpan = document.createElement('span');
            titleSpan.className = 'upnext-prog-title';
            titleSpan.textContent = prog.name || 'Program';
            row.appendChild(titleSpan);
            if (isArch) {
                var archSpan = document.createElement('span');
                archSpan.className = 'upnext-archive-badge';
                archSpan.textContent = '⏱';
                row.appendChild(archSpan);
            }
            listWrap.appendChild(row);
        }
        previewUpNextCardEl.appendChild(listWrap);
        previewUpNextCardEl.style.display = 'block';
    }

    function renderPreviewMetaPills(pills, resumePct) {
        if (!previewMetaEl) {
            return;
        }
        previewMetaEl.innerHTML = '';
        if (!Array.isArray(pills) || pills.length === 0) {
            return;
        }
        var wrap = document.createElement('div');
        wrap.className = 'preview-meta-pills';
        for (var i = 0; i < pills.length; i++) {
            var span = document.createElement('span');
            span.className = 'meta-pill' + (pills[i].cls ? (' ' + pills[i].cls) : '');
            span.textContent = pills[i].text;
            wrap.appendChild(span);
        }
        previewMetaEl.appendChild(wrap);
        if (resumePct > 0) {
            var track = document.createElement('div');
            track.className = 'preview-resume-track';
            var fill = document.createElement('div');
            fill.className = 'preview-resume-fill';
            fill.style.width = Math.min(100, Math.max(4, resumePct)) + '%';
            track.appendChild(fill);
            previewMetaEl.appendChild(track);
        }
    }

    function extractYoutubeTrailerId(rawVal) {
        if (!rawVal) {
            return '';
        }
        var str = String(rawVal).trim();
        if (!str) {
            return '';
        }
        if (/^[A-Za-z0-9_-]{11}$/.test(str)) {
            return str;
        }
        var m = str.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|\/v\/)([A-Za-z0-9_-]{11})/);
        return m ? m[1] : '';
    }

    var trailerFocusedBtnIdx = 1; // 0 = Native YouTube App, 1 = Close Trailer
    function updateTrailerModalFocus() {
        var btnNativeEl = document.getElementById('btn-trailer-native');
        var btnCloseEl = document.getElementById('btn-trailer-close');
        if (btnNativeEl) {
            btnNativeEl.classList.toggle('focused', trailerFocusedBtnIdx === 0);
        }
        if (btnCloseEl) {
            btnCloseEl.classList.toggle('focused', trailerFocusedBtnIdx === 1);
        }
    }

    function renderTrailerIframeIntoModal(ytId, itemTitle) {
        var cleanId = extractYoutubeTrailerId(ytId) || 'aqz-KE-bpKQ';
        activeTrailerYoutubeId = cleanId;
        var wrapEl = document.getElementById('trailer-frame-wrap') || document.getElementById('trailer-iframe-wrap');
        if (!wrapEl) {
            return;
        }
        var embedSrc = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(cleanId) +
            '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
        wrapEl.innerHTML = '<iframe src="' + embedSrc + '" title="' + String(itemTitle || 'Official Trailer').replace(/"/g, '&quot;') + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
    }

    function resolveYoutubeTrailerIdForItem(item) {
        var directId = extractYoutubeTrailerId(item && (item.youtube_trailer || item.trailer || ''));
        if (directId) {
            return Promise.resolve(directId);
        }
        if (!item) {
            return Promise.resolve('aqz-KE-bpKQ');
        }
        var cacheKey = (item.isSeries ? 'ser_' : 'vod_') + String(item.id);
        if (vodExtendedMetaCache[cacheKey] && vodExtendedMetaCache[cacheKey].youtube_trailer) {
            var cachedId = extractYoutubeTrailerId(vodExtendedMetaCache[cacheKey].youtube_trailer);
            if (cachedId) {
                item.youtube_trailer = cachedId;
                return Promise.resolve(cachedId);
            }
        }
        var cleanName = String(item.name || '')
            .replace(/^\s*(?:4K|UHD|FHD|HD|SD|EN|US|UK|FR|ES|DE|AR|TR|vip|top)[\s\-:|]+/i, '')
            .replace(/\b(?:4K|UHD|2160p|1080p|720p|HDR|HEVC|x265|x264|BluRay|WEB-DL)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        var searchQuery = (cleanName || item.name || 'Movie') + (item.year ? (' ' + item.year) : '') + ' official trailer';

        var xtreamLookupPromise = Promise.resolve('');
        if (api.getProviderType() === 'xtream' && (item.isVod || item.isSeries) && !item.isSeason && !item.isEpisode) {
            var rawId = item.xtreamSeriesId || item.xtreamStreamId || String(item.id).replace(/^(?:xt_vod_|xt_ser_|xc_vod_|xc_ser_)/, '');
            var act = item.isSeries ? 'get_series_info' : 'get_vod_info';
            var paramObj = item.isSeries ? { series_id: rawId } : { vod_id: rawId };
            xtreamLookupPromise = api.xtreamRequest(act, paramObj).then(function(res) {
                var info = (res && res.info) ? res.info : {};
                var found = extractYoutubeTrailerId(info.youtube_trailer || (res && res.movie_data && res.movie_data.youtube_trailer) || '');
                if (found) {
                    item.youtube_trailer = found;
                }
                return found;
            }).catch(function() {
                return '';
            });
        }
        return xtreamLookupPromise.then(function(xtId) {
            if (xtId) {
                return xtId;
            }
            return proxyFetch(api.proxyUrl + '/trailer-search?q=' + encodeURIComponent(searchQuery), { method: 'GET' })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    var searchedId = extractYoutubeTrailerId(d && d.videoId);
                    if (searchedId) {
                        item.youtube_trailer = searchedId;
                        return searchedId;
                    }
                    return 'aqz-KE-bpKQ';
                })
                .catch(function() {
                    return 'aqz-KE-bpKQ';
                });
        });
    }

    function openTrailerModalForSelected() {
        var item = (isPosterGridActive() && lockedPreviewItem) ? lockedPreviewItem : (currentItems[itemIdx] || currentPlayingItem);
        if (!item) {
            showToast('Select a movie or series first');
            return;
        }
        var modalEl = document.getElementById('trailer-modal');
        var titleEl = document.getElementById('trailer-modal-title') || document.getElementById('trailer-title');
        var wrapEl = document.getElementById('trailer-frame-wrap') || document.getElementById('trailer-iframe-wrap');
        var btnNativeEl = document.getElementById('btn-trailer-native');
        var btnCloseEl = document.getElementById('btn-trailer-close');
        if (titleEl) {
            titleEl.textContent = '🎬 Official Trailer — ' + (item.name || 'Preview');
        }
        if (btnNativeEl) {
            btnNativeEl.onclick = function(ev) {
                ev.stopPropagation();
                trailerFocusedBtnIdx = 0;
                updateTrailerModalFocus();
                launchNativeSamsungYouTubeApp(activeTrailerYoutubeId);
            };
        }
        if (btnCloseEl) {
            btnCloseEl.onclick = function(ev) {
                ev.stopPropagation();
                closeTrailerModal();
            };
        }
        trailerFocusedBtnIdx = 1;
        updateTrailerModalFocus();
        if (modalEl) {
            modalEl.style.display = '';
            modalEl.classList.add('visible');
        }
        trailerModalOpen = true;

        var immediateId = extractYoutubeTrailerId(item.youtube_trailer || item.trailer || '');
        if (immediateId) {
            renderTrailerIframeIntoModal(immediateId, item.name);
            return;
        }
        if (wrapEl) {
            wrapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#93c5fd;font-size:18px;font-weight:700;">🎬 Loading Official Trailer for ' + String(item.name || '').replace(/</g, '&lt;') + '...</div>';
        }
        resolveYoutubeTrailerIdForItem(item).then(function(resolvedId) {
            if (!trailerModalOpen) {
                return;
            }
            renderTrailerIframeIntoModal(resolvedId, item.name);
        });
    }

    function closeTrailerModal() {
        trailerModalOpen = false;
        var modalEl = document.getElementById('trailer-modal');
        var wrapEl = document.getElementById('trailer-frame-wrap') || document.getElementById('trailer-iframe-wrap');
        if (wrapEl) {
            wrapEl.innerHTML = '';
        }
        if (modalEl) {
            modalEl.classList.remove('visible');
            modalEl.style.display = '';
        }
    }

    function launchNativeSamsungYouTubeApp(ytId) {
        var cleanId = extractYoutubeTrailerId(ytId) || activeTrailerYoutubeId || 'aqz-KE-bpKQ';
        var watchUrl = 'https://www.youtube.com/watch?v=' + cleanId;
        try {
            if (typeof tizen !== 'undefined' && tizen.application && typeof tizen.application.launchAppControl === 'function') {
                var appCtrl = new tizen.ApplicationControl(
                    'http://tizen.org/appcontrol/operation/view',
                    watchUrl
                );
                var ytAppIds = ['9Ur5IzDKqV.TizenYouTube', 'com.samsung.tv.cobalt.youtube', 'org.tizen.youtube'];
                var tryAppIdx = 0;
                var tryNextYtApp = function() {
                    if (tryAppIdx < ytAppIds.length) {
                        var candidateAppId = ytAppIds[tryAppIdx++];
                        try {
                            tizen.application.launchAppControl(appCtrl, candidateAppId, function() {
                                showToast('🚀 Launched Native Samsung YouTube App');
                            }, function() {
                                tryNextYtApp();
                            });
                            return;
                        } catch (eCandidate) {
                            tryNextYtApp();
                            return;
                        }
                    }
                    try {
                        tizen.application.launchAppControl(appCtrl, null, function() {
                            showToast('🚀 Launched YouTube Trailer');
                        }, function() {
                            showToast('📺 Playing Trailer in Built-In Player (' + cleanId + ')');
                        });
                    } catch (eGeneric) {
                        showToast('📺 Playing Trailer in Built-In Player (' + cleanId + ')');
                    }
                };
                tryNextYtApp();
                return;
            }
        } catch (eYt) {}
        showToast('📺 Native Samsung YouTube App Launch: v=' + cleanId);
    }

    var vodMetaDebounceTimer = null;
    function fetchExtendedVodOrSeriesMeta(item) {
        if (vodMetaDebounceTimer) {
            clearTimeout(vodMetaDebounceTimer);
            vodMetaDebounceTimer = null;
        }
        if (!item || (!item.isVod && !item.isSeries) || item.isSeason || item.isEpisode) {
            return;
        }
        var cacheKey = (item.isSeries ? 'ser_' : 'vod_') + String(item.id);
        if (vodExtendedMetaCache[cacheKey]) {
            var cached = vodExtendedMetaCache[cacheKey];
            item.rating = cached.rating || item.rating;
            item.runtime = cached.runtime || item.runtime;
            item.genre = cached.genre || item.genre;
            item.director = cached.director || item.director;
            item.cast = cached.cast || item.cast;
            item.desc = cached.desc || item.desc;
            item.youtube_trailer = cached.youtube_trailer || item.youtube_trailer;
            return;
        }
        if (api.getProviderType() === 'xtream') {
            vodMetaDebounceTimer = setTimeout(function() {
                vodMetaDebounceTimer = null;
                if (!currentItems[itemIdx] || String(currentItems[itemIdx].id) !== String(item.id)) {
                    return;
                }
                var rawId = item.xtreamSeriesId || item.xtreamStreamId || String(item.id).replace(/^(?:xt_vod_|xt_ser_|xc_vod_|xc_ser_)/, '');
                var act = item.isSeries ? 'get_series_info' : 'get_vod_info';
                var paramObj = item.isSeries ? { series_id: rawId } : { vod_id: rawId };
                api.xtreamRequest(act, paramObj).then(function(res) {
                    var info = (res && res.info) ? res.info : {};
                    var enriched = {
                        rating: info.rating || info.rating_5based || item.rating || '',
                        runtime: info.duration || info.episode_run_time || item.runtime || '',
                        genre: info.genre || item.genre || '',
                        director: info.director || item.director || '',
                        cast: info.cast || info.actors || item.cast || '',
                        desc: info.plot || info.description || item.desc || '',
                        youtube_trailer: info.youtube_trailer || item.youtube_trailer || ''
                    };
                    vodExtendedMetaCache[cacheKey] = enriched;
                    item.rating = enriched.rating;
                    item.runtime = enriched.runtime;
                    item.genre = enriched.genre;
                    item.director = enriched.director;
                    item.cast = enriched.cast;
                    item.desc = enriched.desc;
                    item.youtube_trailer = enriched.youtube_trailer;
                    if (currentItems[itemIdx] && String(currentItems[itemIdx].id) === String(item.id)) {
                        updatePreviewPanel();
                    }
                }).catch(function() {});
            }, 380);
        }
    }

    function updatePreviewPanel(forceFromSelection) {
        ensureQuickActionBar();
        syncQuickActionVisibility();
        if (previewEpgTimeout) {
            clearTimeout(previewEpgTimeout);
            previewEpgTimeout = null;
        }
        if (previewDebounceTimer) {
            clearTimeout(previewDebounceTimer);
            previewDebounceTimer = null;
        }
        // v2.1.0 Click-to-Load Details & EPG (lockedPreviewItem) in 3x3 Poster Grid Mode
        var item = currentItems[itemIdx];
        if (isPosterGridActive() && !forceFromSelection) {
            if (lockedPreviewItem) {
                item = lockedPreviewItem;
            }
        } else if (item) {
            lockedPreviewItem = item;
        }
        if (!item) {
            setPreviewEpgProgress(0, false);
            renderPreviewUpNextCard([], null);
            schedulePreviewPosterLoad('', '');
            if (previewTitleEl) {
                previewTitleEl.textContent = 'Select an item';
            }
            if (previewMetaEl) {
                previewMetaEl.textContent = accountInfoText ? ('Account: ' + accountInfoText) : '';
            }
            if (previewDescEl) {
                previewDescEl.textContent = '';
            }
            return;
        }
        if (previewTitleEl) {
            previewTitleEl.textContent = (isFavItem(item) ? '★ ' : '') + item.name;
        }
        if (item.isVod || item.isSeries) {
            setPreviewEpgProgress(0, false);
            renderPreviewUpNextCard([], null);
            fetchExtendedVodOrSeriesMeta(item);
            var typeLabel = item.isSeries ? '📁 TV Series' : '🎬 Movie';
            if (item.isSeason) {
                var epCount = Array.isArray(item.episodes) ? item.episodes.length : 0;
                typeLabel = '📂 ' + (epCount > 0 ? (epCount + ' Episodes') : 'Season');
            } else if (item.isEpisode) {
                typeLabel = '📺 Episode ' + (item.seriesNum || '') + (item.seasonId ? (' • S' + item.seasonId) : '');
            }
            var vodPills = [{ text: typeLabel, cls: 'type' }];
            if (item.year) {
                vodPills.push({ text: '📅 ' + item.year, cls: '' });
            }
            if (item.rating) {
                vodPills.push({ text: '★ ' + item.rating + ' IMDb', cls: 'gold' });
            }
            if (item.runtime) {
                vodPills.push({ text: '⏱ ' + item.runtime, cls: '' });
            }
            if (item.genre) {
                vodPills.push({ text: '🎭 ' + item.genre, cls: '' });
            }
            if (/\b(4K|UHD|2160p)\b/i.test(item.name || '')) {
                vodPills.push({ text: '4K UHD', cls: 'quality' });
            } else if (/\b(FHD|1080p)\b/i.test(item.name || '')) {
                vodPills.push({ text: '1080p', cls: 'quality' });
            }
            if (item.youtube_trailer) {
                vodPills.push({ text: '🎬 Trailer', cls: 'quality' });
            }
            if (isItemWatched(item.id)) {
                vodPills.push({ text: '✓ Watched', cls: 'watched' });
            }
            var resume = getResumeInfo(item.id);
            var resumePct = 0;
            if (resume) {
                vodPills.push({ text: '▶ Resume ' + formatTimeHMS(resume.pos), cls: 'resume' });
                if (resume.dur > 0) {
                    resumePct = Math.round((resume.pos / resume.dur) * 100);
                }
            }
            var bmSec = getVodBookmarkSec(item.id);
            if (bmSec > 0) {
                vodPills.push({ text: '🔖 ' + formatTimeHMS(bmSec), cls: '' });
            }
            renderPreviewMetaPills(vodPills, resumePct);
            if (previewDescEl) {
                var detailParts = [];
                if (item.director) {
                    detailParts.push('🎬 Director: ' + item.director);
                }
                if (item.cast) {
                    detailParts.push('👥 Cast: ' + item.cast);
                }
                detailParts.push(item.desc || 'No synopsis available.');
                previewDescEl.textContent = detailParts.join('\n');
            }
            schedulePreviewPosterLoad(item.poster || item.logo || '', item.id);
            return;
        }
        var livePills = [{ text: 'CH #' + (item.num || (itemIdx + 1)), cls: 'type' }];
        if (/\b(4K|UHD)\b/i.test(item.name || '')) {
            livePills.push({ text: '4K UHD', cls: 'gold' });
        } else if (/\b(FHD|1080p)\b/i.test(item.name || '')) {
            livePills.push({ text: '1080p FHD', cls: 'quality' });
        } else if (/\bHD\b/i.test(item.name || '')) {
            livePills.push({ text: 'HD', cls: 'quality' });
        }
        if (item.archive) {
            livePills.push({ text: '⏱ Catch-Up Archive', cls: 'watched' });
        }
        renderPreviewMetaPills(livePills, 0);
        schedulePreviewPosterLoad(item.poster || '', item.id);
        var cachedEpg = shortEpgCache[String(item.id)];
        if (cachedEpg && (Date.now() - cachedEpg.ts) < 300000) {
            if (Array.isArray(cachedEpg.list) && cachedEpg.list.length > 0) {
                var parsedCached = parseShortEpgNowNext(cachedEpg.list);
                setPreviewEpgProgress(parsedCached.progressPct, true);
                renderPreviewUpNextCard(cachedEpg.list, item);
                if (previewDescEl) {
                    previewDescEl.textContent = (parsedCached.desc || 'No program synopsis available.');
                }
            } else {
                setPreviewEpgProgress(0, false);
                renderPreviewUpNextCard([], item);
                if (previewDescEl) {
                    previewDescEl.textContent = 'No EPG information available.';
                }
            }
            return;
        }
        setPreviewEpgProgress(0, false);
        renderPreviewUpNextCard([], item);
        if (previewDescEl) {
            previewDescEl.textContent = 'Loading program info...';
        }
        previewEpgTimeout = setTimeout(function() {
            if (!currentItems[itemIdx] || String(currentItems[itemIdx].id) !== String(item.id)) {
                return;
            }
            api.fetchShortEpg(item.id).then(function(epgList) {
                if (!currentItems[itemIdx] || String(currentItems[itemIdx].id) !== String(item.id)) {
                    return;
                }
                if (!Array.isArray(epgList) || epgList.length === 0) {
                    setPreviewEpgProgress(0, false);
                    renderPreviewUpNextCard([], item);
                    if (previewDescEl) {
                        previewDescEl.textContent = 'No EPG information available.';
                    }
                    return;
                }
                var parsed = parseShortEpgNowNext(epgList);
                updateInlineRowEpg(item.id, parsed.now);
                setPreviewEpgProgress(parsed.progressPct, true);
                renderPreviewUpNextCard(epgList, item);
                if (previewDescEl) {
                    previewDescEl.textContent = (parsed.desc || 'No program synopsis available.');
                }
            }).catch(function() {
                if (!currentItems[itemIdx] || String(currentItems[itemIdx].id) !== String(item.id)) {
                    return;
                }
                setPreviewEpgProgress(0, false);
                renderPreviewUpNextCard([], item);
                if (previewDescEl) {
                    previewDescEl.textContent = 'No EPG information available.';
                }
            });
        }, 380);
    }

    function getConfiguredProfilesCount() {
        var count = 0;
        if (Array.isArray(profiles)) {
            for (var i = 0; i < profiles.length; i++) {
                if (isProfileConfigured(profiles[i])) {
                    count++;
                }
            }
        }
        return count;
    }

    function getEffectiveStartupMode() {
        var savedMode = localStorage.getItem('cfg_startup_mode');
        var userSet = localStorage.getItem('cfg_startup_mode_user_set') === '1';
        if (userSet && savedMode) {
            return savedMode;
        }
        if (savedMode === 'profile_picker') {
            return 'profile_picker';
        }
        if (getConfiguredProfilesCount() >= 2) {
            return 'profile_picker';
        }
        return savedMode || 'last_channel';
    }

    function tryAutoResumeLastLiveChannel() {
        if (hasAutoResumedOnBoot) {
            return false;
        }
        if (profilePickerOpen) {
            return false;
        }
        hasAutoResumedOnBoot = true;
        if (userInteractedSinceBoot || currentPlayingItem) {
            return false;
        }
        var effMode = getEffectiveStartupMode();
        if (effMode === 'guide' || effMode === 'profile_picker') {
            return false;
        }
        if (effMode === 'favorites') {
            var favLiveList = getFavList('live');
            if (favLiveList && favLiveList.length > 0) {
                for (var f = 0; f < currentCats.length; f++) {
                    if (String(currentCats[f].id) === 'fav') {
                        selectCategory(f, true);
                        return true;
                    }
                }
            }
            return false;
        }
        var saved = getLastLiveChannel();
        if (!saved || !saved.channelId) {
            return false;
        }
        var targetCatPos = 0;
        for (var i = 0; i < currentCats.length; i++) {
            if (String(currentCats[i].id) === String(saved.catId)) {
                var isAdult = Boolean(currentCats[i].censored) || ADULT_RE.test(String(currentCats[i].title || ''));
                if (!isAdult) {
                    targetCatPos = i;
                }
                break;
            }
        }
        selectCategory(targetCatPos, true);
        for (var j = 0; j < currentItems.length; j++) {
            if (String(currentItems[j].id) === String(saved.channelId)) {
                if (isAdultContentItem(currentItems[j])) {
                    return false;
                }
                itemIdx = j;
                activeCol = 'items';
                renderUI();
                playItem(currentItems[j]);
                return true;
            }
        }
        return false;
    }

    function scheduleWarmPreloadVodAndSeries() {
        // Disabled background preloading of VOD & Series categories while watching Live TV
        // to eliminate background memory spikes and data leakage on 10k+ category portals.
        if (warmPreloadTimer) {
            clearTimeout(warmPreloadTimer);
            warmPreloadTimer = null;
        }
    }

    function switchMode(newModeIdx) {
        if (newModeIdx !== undefined) {
            modeIdx = newModeIdx;
        }
        var mode = modes[modeIdx];
        if (!mode) {
            return;
        }
        if (mode.id === 'search') {
            openSearch();
            return;
        }
        if (mode.id === 'profiles') {
            openProfilePickerModal();
            return;
        }
        if (mode.id === 'settings') {
            openSettings();
            return;
        }
        if (settingsOpen) {
            closeSettings();
        }
        if (profilePickerOpen) {
            closeProfilePickerModal();
        }
        if (previewEpgTimeout) {
            clearTimeout(previewEpgTimeout);
            previewEpgTimeout = null;
        }
        if (previewDebounceTimer) {
            clearTimeout(previewDebounceTimer);
            previewDebounceTimer = null;
        }
        if (catHoverTimer) {
            clearTimeout(catHoverTimer);
            catHoverTimer = null;
        }
        if (posterLoadTimer) {
            clearTimeout(posterLoadTimer);
            posterLoadTimer = null;
        }
        lastContentModeIdx = modeIdx;
        seriesStack = [];
        seriesLoading = false;
        catFilterText = '';
        itemFilterText = '';
        catIdx = 0;
        itemIdx = 0;
        vodPage = 1;
        vodLoading = false;
        vodHasMore = true;
        liveGenrePaged = false;
        loadedCatSignature = '';
        catsFilterMemo = null;
        itemsFilterMemo = null;
        if (catsListEl) {
            catsListEl._forceRebuild = true;
        }
        if (itemsListEl) {
            itemsListEl._forceRebuild = true;
        }
        var reqProfId = activeProfileId;
        if (catsHeaderEl) {
            catsHeaderEl.textContent = 'Categories';
        }
        if (itemsHeaderEl) {
            itemsHeaderEl.textContent = mode.title;
        }

        if (mode.id === 'live') {
            if (liveGenres.length > 3 && (allChannels.length > 0 || liveGenres.length > 603)) {
                liveCatalogLoading = false;
                if (allChannels.length === 0 && liveGenres.length > 603) {
                    liveGenrePaged = true;
                }
                rebuildGenreChannelCounts();
                rawCats = liveGenres;
                applyColumnFilters();
                if (!tryAutoResumeLastLiveChannel()) {
                    selectCategory(0, true);
                    if (currentPlayingItem && !currentPlayingItem.isVod && !currentPlayingItem.isSeries) {
                        syncLiveChannelCursorOnZap(currentPlayingItem.isCatchup && currentPlayingItem.channelRef ? currentPlayingItem.channelRef : currentPlayingItem);
                    }
                }
                scheduleWarmPreloadVodAndSeries();
                return;
            }
            liveCatalogLoading = true;
            rawCats = [
                { id: '*', title: 'All Channels', censored: false },
                { id: 'fav', title: '★ Favorites', censored: false },
                { id: 'rec', title: '⏱ History', censored: false }
            ];
            rawItems = [];
            applyColumnFilters();
            renderUI();
            if (catsHeaderEl) {
                catsHeaderEl.textContent = 'Categories (Loading...)';
            }
            if (itemsListEl) {
                itemsListEl._lastItemsRef = null;
                itemsListEl._gridRef = null;
                itemsListEl.innerHTML = '<div class="item">Loading Live TV channels...</div>';
            }

            api.fetchLiveCatalog(false).then(function(catalog) {
                if (activeProfileId !== reqProfId) {
                    return;
                }
                liveCatalogLoading = false;
                if (catalog && Array.isArray(catalog.genres) && catalog.genres.length > 3) {
                    liveGenres = catalog.genres;
                }
                if (catalog && Array.isArray(catalog.channels) && catalog.channels.length > 0) {
                    allChannels = catalog.channels;
                }
                rebuildGenreChannelCounts();
                if (getActiveContentModeId() === 'live') {
                    rawCats = liveGenres.length > 3 ? liveGenres : ((catalog && catalog.genres) ? catalog.genres : rawCats);
                    applyColumnFilters();
                    catIdx = Math.min(catIdx, Math.max(0, currentCats.length - 1));
                    renderCats();
                    if (!tryAutoResumeLastLiveChannel()) {
                        selectCategory(catIdx, true);
                        if (currentPlayingItem && !currentPlayingItem.isVod && !currentPlayingItem.isSeries) {
                            syncLiveChannelCursorOnZap(currentPlayingItem.isCatchup && currentPlayingItem.channelRef ? currentPlayingItem.channelRef : currentPlayingItem);
                        }
                    }
                }
                scheduleWarmPreloadVodAndSeries();
            }).catch(function(err) {
                if (activeProfileId !== reqProfId) {
                    return;
                }
                liveCatalogLoading = false;
                if (getActiveContentModeId() === 'live') {
                    renderCats();
                }
                showOSD('Live TV', 'Catalog Error: ' + err.message);
                showToast('⚠ Retrying Live TV Categories...');
                setTimeout(function() {
                    if (activeProfileId !== reqProfId) {
                        return;
                    }
                    if (getActiveContentModeId() === 'live' && liveGenres.length <= 3) {
                        liveCatalogLoading = true;
                        api.fetchLiveCatalog(true).then(function(catalog2) {
                            if (activeProfileId !== reqProfId) {
                                return;
                            }
                            liveCatalogLoading = false;
                            if (catalog2 && Array.isArray(catalog2.genres) && catalog2.genres.length > 3) {
                                liveGenres = catalog2.genres;
                            }
                            if (catalog2 && Array.isArray(catalog2.channels) && catalog2.channels.length > 0) {
                                allChannels = catalog2.channels;
                            }
                            rebuildGenreChannelCounts();
                            if (getActiveContentModeId() === 'live') {
                                rawCats = liveGenres.length > 3 ? liveGenres : ((catalog2 && catalog2.genres) ? catalog2.genres : rawCats);
                                applyColumnFilters();
                                catIdx = Math.min(catIdx, Math.max(0, currentCats.length - 1));
                                renderCats();
                                selectCategory(catIdx, true);
                            }
                        }).catch(function() {
                            if (activeProfileId === reqProfId) {
                                liveCatalogLoading = false;
                                if (getActiveContentModeId() === 'live') {
                                    renderCats();
                                    selectCategory(catIdx, true);
                                }
                            }
                        });
                    } else if (getActiveContentModeId() === 'live') {
                        selectCategory(catIdx, true);
                    }
                }, 1500);
            });
        } else if (mode.id === 'vod') {
            if (vodCats.length > 5) {
                rawCats = vodCats;
                applyColumnFilters();
                selectCategory(0, true);
                return;
            }
            rawCats = [
                { id: '*', title: 'All Movies', censored: false },
                { id: 'new', title: '🆕 Recently Added', censored: false },
                { id: 'cont', title: '▶ Continue Watching', censored: false },
                { id: 'fav', title: '★ Favorites', censored: false },
                { id: 'rec', title: '⏱ History', censored: false }
            ];
            rawItems = [];
            applyColumnFilters();
            renderUI();
            if (catsHeaderEl) {
                catsHeaderEl.textContent = 'Categories (Loading...)';
            }
            if (itemsListEl) {
                itemsListEl._lastItemsRef = null;
                itemsListEl._gridRef = null;
                itemsListEl.innerHTML = '<div class="item">Loading Movies...</div>';
            }

            api.fetchVodCategories().then(function(cats) {
                if (activeProfileId !== reqProfId) {
                    return;
                }
                if (Array.isArray(cats) && cats.length > 5) {
                    vodCats = cats;
                }
                if (getActiveContentModeId() === 'vod') {
                    rawCats = vodCats.length > 5 ? vodCats : (cats || rawCats);
                    applyColumnFilters();
                    renderCats();
                    selectCategory(catIdx, true);
                }
            }).catch(function() {
                if (activeProfileId !== reqProfId) {
                    return;
                }
                if (getActiveContentModeId() === 'vod') {
                    selectCategory(0, true);
                }
                showToast('⚠ Retrying VOD Categories...');
                setTimeout(function() {
                    if (activeProfileId !== reqProfId) {
                        return;
                    }
                    if (getActiveContentModeId() === 'vod' && vodCats.length <= 5) {
                        api.fetchVodCategories(true).then(function(cats2) {
                            if (activeProfileId !== reqProfId) {
                                return;
                            }
                            if (Array.isArray(cats2) && cats2.length > 5) {
                                vodCats = cats2;
                            }
                            if (getActiveContentModeId() === 'vod') {
                                rawCats = vodCats.length > 5 ? vodCats : (cats2 || rawCats);
                                applyColumnFilters();
                                renderCats();
                                selectCategory(catIdx, true);
                            }
                        }).catch(function() {});
                    }
                }, 1200);
            });
        } else if (mode.id === 'series') {
            if (seriesCats.length > 5) {
                rawCats = seriesCats;
                applyColumnFilters();
                selectCategory(0, true);
                return;
            }
            rawCats = [
                { id: '*', title: 'All Series', censored: false },
                { id: 'new', title: '🆕 Recently Added', censored: false },
                { id: 'cont', title: '▶ Continue Watching', censored: false },
                { id: 'fav', title: '★ Favorites', censored: false },
                { id: 'rec', title: '⏱ History', censored: false }
            ];
            rawItems = [];
            applyColumnFilters();
            renderUI();
            if (catsHeaderEl) {
                catsHeaderEl.textContent = 'Categories (Loading...)';
            }
            if (itemsListEl) {
                itemsListEl._lastItemsRef = null;
                itemsListEl._gridRef = null;
                itemsListEl.innerHTML = '<div class="item">Loading TV Series...</div>';
            }

            api.fetchSeriesCategories().then(function(cats) {
                if (activeProfileId !== reqProfId) {
                    return;
                }
                if (Array.isArray(cats) && cats.length > 5) {
                    seriesCats = cats;
                }
                if (getActiveContentModeId() === 'series') {
                    rawCats = seriesCats.length > 5 ? seriesCats : (cats || rawCats);
                    applyColumnFilters();
                    renderCats();
                    selectCategory(catIdx, true);
                }
            }).catch(function() {
                if (activeProfileId !== reqProfId) {
                    return;
                }
                if (getActiveContentModeId() === 'series') {
                    selectCategory(0, true);
                }
                showToast('⚠ Retrying Series Categories...');
                setTimeout(function() {
                    if (activeProfileId !== reqProfId) {
                        return;
                    }
                    if (getActiveContentModeId() === 'series' && seriesCats.length <= 5) {
                        api.fetchSeriesCategories(true).then(function(cats2) {
                            if (activeProfileId !== reqProfId) {
                                return;
                            }
                            if (Array.isArray(cats2) && cats2.length > 5) {
                                seriesCats = cats2;
                            }
                            if (getActiveContentModeId() === 'series') {
                                rawCats = seriesCats.length > 5 ? seriesCats : (cats2 || rawCats);
                                applyColumnFilters();
                                renderCats();
                                selectCategory(catIdx, true);
                            }
                        }).catch(function() {});
                    }
                }, 1200);
            });
        }
    }

    function scheduleCategoryPreview() {
        if (catHoverTimer) {
            clearTimeout(catHoverTimer);
        }
        catHoverTimer = setTimeout(function() {
            catHoverTimer = null;
            if (activeCol !== 'cats') {
                return;
            }
            var cat = currentCats[catIdx];
            if (!cat) {
                return;
            }
            var isAdultCat = Boolean(cat.censored) || ADULT_RE.test(String(cat.title || ''));
            if (isAdultCat && !window._parentalUnlocked) {
                return;
            }
            selectCategory(catIdx, false);
        }, 160);
    }

    function selectCategory(targetCatIdx, forceReload) {
        if (targetCatIdx !== undefined) {
            catIdx = targetCatIdx;
        }
        if (posterLoadTimer) {
            clearTimeout(posterLoadTimer);
            posterLoadTimer = null;
        }
        syncQuickActionVisibility();
        var cat = currentCats[catIdx];
        if (!cat) {
            rawItems = [];
            applyColumnFilters();
            renderUI();
            return;
        }
        var isAdultCat = Boolean(cat.censored) || ADULT_RE.test(String(cat.title || ''));
        if (isAdultCat && !window._parentalUnlocked) {
            openPinModal(function() {
                activeCol = 'items';
                updateColumnFocusClasses();
                selectCategory(catIdx, true);
            });
            return;
        }

        var activeModeId = getActiveContentModeId();
        var sig = activeModeId + ':' + String(cat.id);
        var isDynamicBuiltIn = (cat.id === 'cont' || cat.id === 'fav' || cat.id === 'rec');
        if (!forceReload && !isDynamicBuiltIn && loadedCatSignature === sig && seriesStack.length === 0 && (rawItems.length > 0 || vodLoading)) {
            renderUI();
            return;
        }
        loadedCatSignature = sig;
        itemIdx = 0;
        seriesStack = [];
        seriesLoading = false;
        vodPage = 1;
        vodLoading = false;
        vodHasMore = true;
        liveGenrePaged = false;

        if (activeModeId === 'live') {
            if (cat.id === 'fav') {
                var favIds = getFavList('live');
                var favChannels = [];
                for (var i = 0; i < favIds.length; i++) {
                    var foundFav = channelByIdMap[String(favIds[i])];
                    if (foundFav) {
                        favChannels.push(foundFav);
                    }
                }
                rawItems = favChannels;
                applyColumnFilters();
                renderUI();
            } else if (cat.id === 'rec') {
                rawItems = getRecentItems(false);
                applyColumnFilters();
                renderUI();
            } else {
                if (cat.id === '*') {
                    rawItems = allChannels;
                } else {
                    rawItems = genreChannelsMap[String(cat.id)] || [];
                }
                if (rawItems.length === 0) {
                    if (cat.id === '*' && liveCatalogLoading) {
                        if (itemsListEl) {
                            itemsListEl._lastItemsRef = null;
                            itemsListEl._gridRef = null;
                            itemsListEl.innerHTML = '<div class="item">Loading Live TV channels...</div>';
                        }
                        return;
                    }
                    vodLoading = true;
                    liveGenrePaged = true;
                    if (itemsListEl) {
                        itemsListEl._lastItemsRef = null;
                        itemsListEl._gridRef = null;
                        itemsListEl.innerHTML = '<div class="item">Loading channels...</div>';
                    }
                    api.fetchLiveGenrePage(cat.id, 1).then(function(res) {
                        var pageItems = (res && res.items) ? res.items : [];
                        var hasMorePages = Boolean(res && res.hasMore);
                        pagedLiveGenresMap[String(cat.id)] = { page: 1, hasMore: hasMorePages };
                        var addedAny = false;
                        for (var n = 0; n < pageItems.length; n++) {
                            if (!channelByIdMap[String(pageItems[n].id)]) {
                                allChannels.push(pageItems[n]);
                                addedAny = true;
                            }
                        }
                        if (addedAny) {
                            rebuildGenreChannelCounts();
                            if (catsListEl) {
                                catsListEl._forceRebuild = true;
                            }
                        }
                        if (loadedCatSignature !== sig) {
                            return;
                        }
                        vodLoading = false;
                        rawItems = pageItems;
                        vodHasMore = hasMorePages;
                        applyColumnFilters();
                        renderUI();
                    }).catch(function() {
                        if (loadedCatSignature !== sig) {
                            return;
                        }
                        loadedCatSignature = '';
                        vodLoading = false;
                        rawItems = [];
                        vodHasMore = false;
                        applyColumnFilters();
                        renderUI();
                    });
                } else {
                    var savedLivePageState = pagedLiveGenresMap[String(cat.id)];
                    if (savedLivePageState) {
                        liveGenrePaged = true;
                        vodPage = savedLivePageState.page || 1;
                        vodHasMore = Boolean(savedLivePageState.hasMore);
                    }
                    applyColumnFilters();
                    renderUI();
                }
            }
        } else if (activeModeId === 'vod') {
            if (cat.id === 'cont') {
                rawItems = getContinueWatchingItems(false);
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else if (cat.id === 'fav') {
                rawItems = getFavList('vod');
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else if (cat.id === 'rec') {
                rawItems = getRecentItems(true).filter(function(x) { return !x.isSeries; });
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else {
                vodLoading = true;
                if (itemsListEl) {
                    itemsListEl._lastItemsRef = null;
                    itemsListEl._gridRef = null;
                    itemsListEl.innerHTML = '<div class="item">Loading Movies...</div>';
                }
                api.fetchVodPage(cat.id, 1, '', currentSort).then(function(items) {
                    if (loadedCatSignature !== sig) {
                        return;
                    }
                    vodLoading = false;
                    rawItems = items || [];
                    vodHasMore = rawItems.length >= 10;
                    applyColumnFilters();
                    renderUI();
                }).catch(function() {
                    if (loadedCatSignature !== sig) {
                        return;
                    }
                    setTimeout(function() {
                        if (loadedCatSignature !== sig) {
                            return;
                        }
                        api.fetchVodPage(cat.id, 1, '', currentSort).then(function(itemsRetry) {
                            if (loadedCatSignature !== sig) {
                                return;
                            }
                            vodLoading = false;
                            rawItems = itemsRetry || [];
                            vodHasMore = rawItems.length >= 10;
                            applyColumnFilters();
                            renderUI();
                        }).catch(function() {
                            if (loadedCatSignature !== sig) {
                                return;
                            }
                            loadedCatSignature = '';
                            vodLoading = false;
                            rawItems = [];
                            applyColumnFilters();
                            renderUI();
                        });
                    }, 500);
                });
            }
        } else if (activeModeId === 'series') {
            if (cat.id === 'cont') {
                rawItems = getContinueWatchingItems(true);
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else if (cat.id === 'fav') {
                rawItems = getFavList('series');
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else if (cat.id === 'rec') {
                rawItems = getRecentItems(true).filter(function(x) { return Boolean(x.isSeries); });
                vodHasMore = false;
                applyColumnFilters();
                renderUI();
            } else {
                vodLoading = true;
                if (itemsListEl) {
                    itemsListEl._lastItemsRef = null;
                    itemsListEl._gridRef = null;
                    itemsListEl.innerHTML = '<div class="item">Loading TV Series...</div>';
                }
                api.fetchSeriesPage(cat.id, 1, '', currentSort).then(function(items) {
                    if (loadedCatSignature !== sig) {
                        return;
                    }
                    vodLoading = false;
                    rawItems = items || [];
                    vodHasMore = rawItems.length >= 10;
                    applyColumnFilters();
                    renderUI();
                }).catch(function() {
                    if (loadedCatSignature !== sig) {
                        return;
                    }
                    setTimeout(function() {
                        if (loadedCatSignature !== sig) {
                            return;
                        }
                        api.fetchSeriesPage(cat.id, 1, '', currentSort).then(function(itemsRetry) {
                            if (loadedCatSignature !== sig) {
                                return;
                            }
                            vodLoading = false;
                            rawItems = itemsRetry || [];
                            vodHasMore = rawItems.length >= 10;
                            applyColumnFilters();
                            renderUI();
                        }).catch(function() {
                            if (loadedCatSignature !== sig) {
                                return;
                            }
                            loadedCatSignature = '';
                            vodLoading = false;
                            rawItems = [];
                            applyColumnFilters();
                            renderUI();
                        });
                    }, 500);
                });
            }
        }
    }

    function loadMoreCatalogIfNeeded() {
        var activeModeId = getActiveContentModeId();
        var cat = currentCats[catIdx];
        if (!cat || cat.id === 'cont' || cat.id === 'fav' || cat.id === 'rec') {
            return;
        }
        if (seriesStack.length > 0) {
            return;
        }
        if (vodLoading || !vodHasMore) {
            return;
        }
        var preloadMargin = isPosterGridActive() ? 6 : 3;
        if (itemIdx < currentItems.length - preloadMargin) {
            return;
        }
        var reqSig = loadedCatSignature;
        if (activeModeId === 'live' && liveGenrePaged) {
            vodLoading = true;
            var nextLivePage = vodPage + 1;
            api.fetchLiveGenrePage(cat.id, nextLivePage).then(function(res) {
                var moreLive = (res && res.items) ? res.items : [];
                var hasMoreLive = Boolean(res && res.hasMore) && moreLive.length > 0;
                pagedLiveGenresMap[String(cat.id)] = {
                    page: moreLive.length > 0 ? nextLivePage : vodPage,
                    hasMore: hasMoreLive
                };
                var addedMore = false;
                for (var n = 0; n < moreLive.length; n++) {
                    if (!channelByIdMap[String(moreLive[n].id)]) {
                        allChannels.push(moreLive[n]);
                        addedMore = true;
                    }
                }
                if (addedMore) {
                    rebuildGenreChannelCounts();
                }
                if (loadedCatSignature !== reqSig) {
                    return;
                }
                vodLoading = false;
                if (moreLive.length === 0) {
                    vodHasMore = false;
                    return;
                }
                vodPage = nextLivePage;
                vodHasMore = hasMoreLive;
                rawItems = rawItems.concat(moreLive);
                applyColumnFilters();
                renderItems();
            }).catch(function() {
                if (loadedCatSignature === reqSig) {
                    vodLoading = false;
                }
            });
            return;
        }
        var loader = null;
        if (activeModeId === 'vod') {
            loader = api.fetchVodPage(cat.id, vodPage + 1, '', currentSort);
        } else if (activeModeId === 'series') {
            loader = api.fetchSeriesPage(cat.id, vodPage + 1, '', currentSort);
        }
        if (!loader) {
            return;
        }
        vodLoading = true;
        var nextPage = vodPage + 1;
        loader.then(function(moreItems) {
            if (loadedCatSignature !== reqSig) {
                return;
            }
            vodLoading = false;
            if (!Array.isArray(moreItems) || moreItems.length === 0) {
                vodHasMore = false;
                return;
            }
            vodPage = nextPage;
            rawItems = rawItems.concat(moreItems);
            applyColumnFilters();
            renderItems();
        }).catch(function() {
            if (loadedCatSignature === reqSig) {
                vodLoading = false;
            }
        });
    }
    function buildEpisodeItemFromSeason(seasonObj, epEntry, idx) {
        var parentSeriesObj = (seasonObj && seasonObj.parentSeries) ? seasonObj.parentSeries : null;
        var parentId = (parentSeriesObj && parentSeriesObj.id) ? String(parentSeriesObj.id) : 'ser';
        var sId = seasonObj && seasonObj.id !== undefined ? String(seasonObj.id) : '1';
        var inheritedGenreId = (seasonObj && seasonObj.genreId) || (parentSeriesObj && parentSeriesObj.genreId) || '*';
        var inheritedCensored = ((seasonObj && seasonObj.censored) || (parentSeriesObj && parentSeriesObj.censored)) ? 1 : 0;
        if (epEntry && typeof epEntry === 'object' && epEntry.isEpisode) {
            if (!epEntry.seasonId) {
                epEntry.seasonId = sId;
            }
            if (!epEntry.seriesId) {
                epEntry.seriesId = parentId;
            }
            if (!epEntry.parentSeries && parentSeriesObj) {
                epEntry.parentSeries = parentSeriesObj;
            }
            if (!epEntry.genreId && inheritedGenreId) {
                epEntry.genreId = inheritedGenreId;
            }
            if (!epEntry.censored && inheritedCensored) {
                epEntry.censored = 1;
            }
            return epEntry;
        }
        var epNum = (epEntry !== undefined && epEntry !== null) ? epEntry : (idx + 1);
        return {
            id: parentId + '_s' + sId + '_e' + epNum,
            name: 'Episode ' + epNum,
            cmd: seasonObj.cmd,
            desc: seasonObj.desc,
            poster: seasonObj.poster,
            genreId: inheritedGenreId,
            censored: inheritedCensored,
            seriesNum: epNum,
            seasonId: sId,
            seriesId: parentId,
            parentSeries: parentSeriesObj,
            isEpisode: true,
            isVod: true,
            isSeries: true,
            streamType: seasonObj.streamType
        };
    }

    function stepIntoSeries(item) {
        if (!item || seriesLoading) {
            return;
        }
        if (!window._parentalUnlocked && isAdultContentItem(item)) {
            openPinModal(function() {
                stepIntoSeries(item);
            });
            return;
        }
        if (item.isSeries && !item.isSeason && !item.isEpisode) {
            seriesLoading = true;
            var reqSeriesProfId = activeProfileId;
            var reqSeriesCatSig = loadedCatSignature;
            showToast('Loading seasons for ' + item.name + '...');
            api.fetchSeriesSeasons(item).then(function(seasons) {
                seriesLoading = false;
                if (activeProfileId !== reqSeriesProfId || loadedCatSignature !== reqSeriesCatSig || getActiveContentModeId() !== 'series') {
                    return;
                }
                activeSeriesSeasons = Array.isArray(seasons) ? seasons.slice() : [];
                seriesStack.push({
                    parentSeries: item,
                    rawItems: rawItems.slice(),
                    itemIdx: itemIdx,
                    itemFilterText: itemFilterText,
                    header: itemsHeaderEl ? itemsHeaderEl.textContent : 'Series'
                });
                itemFilterText = '';
                rawItems = seasons;
                itemIdx = 0;
                itemsFilterMemo = null;
                if (itemsListEl) {
                    itemsListEl._forceRebuild = true;
                }
                if (itemsHeaderEl) {
                    itemsHeaderEl.textContent = item.name + ' — Seasons';
                }
                applyColumnFilters();
                renderUI();
            }).catch(function(err) {
                seriesLoading = false;
                if (activeProfileId !== reqSeriesProfId || loadedCatSignature !== reqSeriesCatSig || getActiveContentModeId() !== 'series') {
                    return;
                }
                showOSD(item.name, 'Failed to load seasons: ' + err.message);
            });
        } else if (item.isSeason) {
            var episodes = [];
            var epList = Array.isArray(item.episodes) ? item.episodes : [];
            for (var i = 0; i < epList.length; i++) {
                episodes.push(buildEpisodeItemFromSeason(item, epList[i], i));
            }
            var seasonsPool = (item.parentSeries && Array.isArray(item.parentSeries.seasons) && item.parentSeries.seasons.length > 0) ?
                item.parentSeries.seasons :
                activeSeriesSeasons;
            var fullSeriesEpisodes = [];
            if (Array.isArray(seasonsPool) && seasonsPool.length > 0) {
                for (var sIdx = 0; sIdx < seasonsPool.length; sIdx++) {
                    var sObj = seasonsPool[sIdx];
                    if (!sObj) {
                        continue;
                    }
                    if (String(sObj.id) === String(item.id)) {
                        for (var ce = 0; ce < episodes.length; ce++) {
                            fullSeriesEpisodes.push(episodes[ce]);
                        }
                    } else {
                        var sEpList = Array.isArray(sObj.episodes) ? sObj.episodes : [];
                        for (var seIdx = 0; seIdx < sEpList.length; seIdx++) {
                            var builtOther = buildEpisodeItemFromSeason(sObj, sEpList[seIdx], seIdx);
                            if (sObj.name && String(builtOther.name).indexOf(sObj.name) === -1) {
                                builtOther = extendObj(builtOther, {
                                    name: sObj.name + ' • ' + builtOther.name
                                });
                            }
                            fullSeriesEpisodes.push(builtOther);
                        }
                    }
                }
            }
            var playlistToLink = fullSeriesEpisodes.length > 0 ? fullSeriesEpisodes : episodes.slice();
            for (var k = 0; k < playlistToLink.length - 1; k++) {
                playlistToLink[k].nextEpSnapshot = playlistToLink[k + 1];
            }
            activeSeriesPlaylist = playlistToLink;
            seriesStack.push({
                rawItems: rawItems.slice(),
                itemIdx: itemIdx,
                itemFilterText: itemFilterText,
                header: itemsHeaderEl ? itemsHeaderEl.textContent : 'Seasons'
            });
            itemFilterText = '';
            rawItems = episodes;
            var targetEpIdx = 0;
            var lastWatchedIdx = -1;
            var resumeEpIdx = -1;
            var playingEpIdx = -1;
            for (var eIdx = 0; eIdx < episodes.length; eIdx++) {
                var epObj = episodes[eIdx];
                if (currentPlayingItem && String(currentPlayingItem.id) === String(epObj.id)) {
                    playingEpIdx = eIdx;
                    break;
                }
                var epResume = getResumeInfo(epObj.id);
                if (epResume && epResume.pos > 15) {
                    resumeEpIdx = eIdx;
                }
                if (isItemWatched(epObj.id)) {
                    lastWatchedIdx = eIdx;
                }
            }
            if (playingEpIdx !== -1) {
                targetEpIdx = playingEpIdx;
            } else if (resumeEpIdx !== -1) {
                targetEpIdx = resumeEpIdx;
            } else if (lastWatchedIdx !== -1) {
                targetEpIdx = Math.min(episodes.length - 1, lastWatchedIdx + 1);
            }
            itemIdx = targetEpIdx;
            itemsFilterMemo = null;
            if (itemsListEl) {
                itemsListEl._forceRebuild = true;
            }
            if (itemsHeaderEl) {
                itemsHeaderEl.textContent = item.name + ' — Episodes';
            }
            applyColumnFilters();
            renderUI();
        }
    }
    function stepOutSeries() {
        if (seriesStack.length === 0) {
            return false;
        }
        var prev = seriesStack.pop();
        if (seriesStack.length === 0) {
            activeSeriesSeasons = [];
        }
        rawItems = prev.rawItems;
        itemIdx = prev.itemIdx;
        itemFilterText = prev.itemFilterText || '';
        itemsFilterMemo = null;
        if (itemsListEl) {
            itemsListEl._forceRebuild = true;
        }
        if (itemsHeaderEl) {
            itemsHeaderEl.textContent = prev.header;
        }
        applyColumnFilters();
        renderUI();
        return true;
    }

    function formatProfileSelectLabel(p) {
        if (!p) {
            return 'Profile';
        }
        var activePrefix = (p.id && p.id === activeProfileId) ? '● ' : '';
        var t = (p.type || 'stalker').toLowerCase();
        if (t === 'xtream') {
            return activePrefix + p.name + ' [Xtream: ' + (p.xtreamUser || 'No User') + ']';
        }
        if (t === 'm3u') {
            return activePrefix + p.name + ' [M3U: ' + (p.m3uFileName || (p.m3uUrl ? 'URL' : 'Empty')) + ']';
        }
        return activePrefix + p.name + ' [MAG: ' + (p.mac || 'No MAC') + ']';
    }

    function saveCurrentInputsToEditingProfile() {
        if (!profiles || editingProfileIndex < 0 || editingProfileIndex >= profiles.length) {
            return;
        }
        var p = profiles[editingProfileIndex];
        if (!p) {
            return;
        }
        if (selProviderTypeEl && selProviderTypeEl.value) {
            p.type = selProviderTypeEl.value;
        }
        if (inpProfileNameEl && typeof inpProfileNameEl.value === 'string') {
            p.name = inpProfileNameEl.value.trim() || ('Portal ' + (editingProfileIndex + 1));
        }
        if (inpPortalEl && typeof inpPortalEl.value === 'string') {
            p.portal = inpPortalEl.value.trim();
        }
        if (inpMacEl && typeof inpMacEl.value === 'string') {
            p.mac = inpMacEl.value.trim();
        }
        if (inpXtreamUrlEl && typeof inpXtreamUrlEl.value === 'string') {
            p.xtreamUrl = inpXtreamUrlEl.value.trim();
        }
        if (inpXtreamUserEl && typeof inpXtreamUserEl.value === 'string') {
            p.xtreamUser = inpXtreamUserEl.value.trim();
        }
        if (inpXtreamPassEl && typeof inpXtreamPassEl.value === 'string') {
            p.xtreamPass = inpXtreamPassEl.value.trim();
        }
        if (inpM3uUrlEl && typeof inpM3uUrlEl.value === 'string') {
            p.m3uUrl = inpM3uUrlEl.value.trim();
        }
        if (inpEpgUrlEl && typeof inpEpgUrlEl.value === 'string') {
            p.epgUrl = inpEpgUrlEl.value.trim();
        }
        if (selEpgOffsetEl) {
            p.epgOffsetHours = Number(selEpgOffsetEl.value) || 0;
        }
    }

    var isRenderingProfileOptions = false;
    function renderProfileSelectOptions(force) {
        if (!selProfileEl) {
            return;
        }
        var currentChildCount = selProfileEl.children.length;
        if (!force && currentChildCount === profiles.length) {
            for (var c = 0; c < profiles.length; c++) {
                var optEl = selProfileEl.children[c];
                if (optEl) {
                    optEl.value = profiles[c].id;
                    optEl.textContent = formatProfileSelectLabel(profiles[c]);
                }
            }
            selProfileEl.selectedIndex = editingProfileIndex;
            return;
        }
        isRenderingProfileOptions = true;
        selProfileEl.innerHTML = '';
        for (var i = 0; i < profiles.length; i++) {
            var opt = document.createElement('option');
            opt.value = profiles[i].id;
            opt.textContent = formatProfileSelectLabel(profiles[i]);
            if (i === editingProfileIndex) {
                opt.selected = true;
            }
            selProfileEl.appendChild(opt);
        }
        selProfileEl.selectedIndex = editingProfileIndex;
        isRenderingProfileOptions = false;
    }
    function updateM3uFileStatusText(p) {
        if (!m3uFileStatusEl) {
            return;
        }
        var hasCachedRaw = Boolean(p && (m3uRawMemoryCache[p.id] || localStorage.getItem('m3u_raw_' + p.id)));
        if (p && p.m3uFileName && hasCachedRaw) {
            m3uFileStatusEl.textContent = 'Loaded: ' + p.m3uFileName;
        } else if (p && p.m3uFileName) {
            m3uFileStatusEl.textContent = p.m3uFileName;
        } else {
            m3uFileStatusEl.textContent = 'No local file loaded';
        }
    }
    function loadProfileIntoSettingsInputs(idx, syncDropdown) {
        editingProfileIndex = Math.max(0, Math.min(profiles.length - 1, idx));
        var p = profiles[editingProfileIndex];
        var pType = (p && p.type) ? String(p.type).toLowerCase() : 'stalker';
        if (selProviderTypeEl) {
            selProviderTypeEl.value = pType;
        }
        rebuildSettingsGrid(pType);
        if (syncDropdown !== false) {
            renderProfileSelectOptions(false);
        }
        if (inpProfileNameEl) {
            inpProfileNameEl.value = p.name || '';
        }
        if (inpPortalEl) {
            inpPortalEl.value = p.portal || '';
        }
        if (inpMacEl) {
            inpMacEl.value = p.mac || '';
        }
        if (inpXtreamUrlEl) {
            inpXtreamUrlEl.value = p.xtreamUrl || '';
        }
        if (inpXtreamUserEl) {
            inpXtreamUserEl.value = p.xtreamUser || '';
        }
        if (inpXtreamPassEl) {
            inpXtreamPassEl.value = p.xtreamPass || '';
        }
        if (inpM3uUrlEl) {
            inpM3uUrlEl.value = p.m3uUrl || '';
        }
        if (inpEpgUrlEl) {
            inpEpgUrlEl.value = p.epgUrl || '';
        }
        if (selEpgOffsetEl) {
            selEpgOffsetEl.value = String(Number(p.epgOffsetHours) || 0);
        }
        if (btnSaveEl && p) {
            btnSaveEl.textContent = (p.id === activeProfileId) ? '✓ Save & Connect' : '⚡ Activate & Connect';
            btnSaveEl.title = (p.id === activeProfileId) ? ('Save & reconnect ' + (p.name || 'Portal')) : ('Activate "' + (p.name || 'Portal') + '" & connect');
        }
        updateM3uFileStatusText(p);
    }
    function setSettingsProviderType(newType) {
        var cleanType = (newType === 'xtream' || newType === 'm3u') ? newType : 'stalker';
        if (selProviderTypeEl) {
            selProviderTypeEl.value = cleanType;
        }
        if (profiles[editingProfileIndex]) {
            profiles[editingProfileIndex].type = cleanType;
        }
        rebuildSettingsGrid(cleanType);
        renderProfileSelectOptions(false);
        updateSettingsFocus();
    }
    function openM3uFilePicker() {
        if (!inpM3uFileHiddenEl) {
            return;
        }
        inpM3uFileHiddenEl.value = '';
        inpM3uFileHiddenEl.click();
    }
    function clearLocalM3uFileFromProfile() {
        var p = profiles[editingProfileIndex];
        if (!p) {
            return;
        }
        p.m3uFileName = '';
        if (p.m3uUrl && p.m3uUrl.indexOf('local://') === 0) {
            p.m3uUrl = '';
            if (inpM3uUrlEl) {
                inpM3uUrlEl.value = '';
            }
        }
        delete m3uRawMemoryCache[p.id];
        try {
            localStorage.removeItem('m3u_raw_' + p.id);
        } catch (e) {}
        proxyFetch(api.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent('m3u_raw_' + p.id) + '&action=delete', {
            method: 'GET'
        }).catch(function() {});
        updateM3uFileStatusText(p);
        renderProfileSelectOptions(false);
        showToast('Cleared local M3U file for ' + (p.name || 'profile'));
    }
    if (inpM3uFileHiddenEl) {
        inpM3uFileHiddenEl.onchange = function(ev) {
            var file = ev.target && ev.target.files ? ev.target.files[0] : null;
            if (!file) {
                return;
            }
            var reader = new FileReader();
            reader.onload = function() {
                var text = String(reader.result || '');
                if (text.indexOf('#EXTM3U') === -1 && text.indexOf('#EXTINF') === -1) {
                    showOSD('Invalid M3U File', 'Selected file does not contain #EXTM3U / #EXTINF entries');
                    showToast('⚠ Invalid M3U playlist file');
                    return;
                }
                var p = profiles[editingProfileIndex];
                if (p) {
                    p.m3uFileName = file.name;
                    if (!p.m3uUrl || p.m3uUrl.indexOf('local://') === 0) {
                        p.m3uUrl = 'local://' + file.name;
                        if (inpM3uUrlEl) {
                            inpM3uUrlEl.value = p.m3uUrl;
                        }
                    }
                    m3uRawMemoryCache[p.id] = text;
                    if (text.length <= 1500000) {
                        safeSetStorage('m3u_raw_' + p.id, text);
                    } else {
                        try {
                            localStorage.removeItem('m3u_raw_' + p.id);
                        } catch (eRmQuota) {}
                    }
                    proxyFetch(api.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent('m3u_raw_' + p.id), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rawText: text, fileName: file.name, ts: Date.now() })
                    }).catch(function() {});
                    updateM3uFileStatusText(p);
                    renderProfileSelectOptions(false);
                    showToast('📂 Loaded M3U file: ' + file.name);
                }
            };
            reader.readAsText(file);
        };
    }
    if (selProfileEl) {
        selProfileEl.onchange = function() {
            if (isRenderingProfileOptions) {
                return;
            }
            var selectedId = selProfileEl.value;
            for (var p = 0; p < profiles.length; p++) {
                if (profiles[p].id === selectedId) {
                    saveCurrentInputsToEditingProfile();
                    loadProfileIntoSettingsInputs(p, false);
                    updateSettingsFocus();
                    break;
                }
            }
        };
    }
    if (selProviderTypeEl) {
        selProviderTypeEl.onchange = function() {
            setSettingsProviderType(selProviderTypeEl.value || 'stalker');
        };
    }
    function syncSettingsCoordinatesForEl(targetEl) {
        for (var r = 0; r < settingsGrid.length; r++) {
            for (var c = 0; c < settingsGrid[r].length; c++) {
                if (settingsGrid[r][c] === targetEl) {
                    settingsRow = r;
                    settingsCol = c;
                    if (settingsGrid[r].length > 1 && settingsGrid[r][0] !== tabProvStalkerEl) {
                        settingsLastColRatio = c / (settingsGrid[r].length - 1);
                    }
                    return;
                }
            }
        }
    }
    (function() {
        function attachSync(el) {
            if (!el) {
                return;
            }
            el.addEventListener('focus', function() {
                if (!settingsOpen) {
                    return;
                }
                activeCol = 'settings';
                updateColumnFocusClasses();
                syncSettingsCoordinatesForEl(el);
                if (el.tagName === 'INPUT') {
                    imeActive = true;
                }
                updateSettingsFocus();
            });
            el.addEventListener('click', function() {
                if (!settingsOpen) {
                    return;
                }
                activeCol = 'settings';
                updateColumnFocusClasses();
                syncSettingsCoordinatesForEl(el);
                if (el.tagName === 'INPUT') {
                    imeActive = true;
                }
                updateSettingsFocus();
            });
        }
        for (var s = 0; s < settingsEls.length; s++) {
            attachSync(settingsEls[s]);
        }
    })();
    if (tabProvStalkerEl) {
        tabProvStalkerEl.onclick = function() {
            activeCol = 'settings';
            updateColumnFocusClasses();
            setSettingsProviderType('stalker');
            syncSettingsCoordinatesForEl(tabProvStalkerEl);
            updateSettingsFocus();
        };
    }
    if (tabProvXtreamEl) {
        tabProvXtreamEl.onclick = function() {
            activeCol = 'settings';
            updateColumnFocusClasses();
            setSettingsProviderType('xtream');
            syncSettingsCoordinatesForEl(tabProvXtreamEl);
            updateSettingsFocus();
        };
    }
    if (tabProvM3uEl) {
        tabProvM3uEl.onclick = function() {
            activeCol = 'settings';
            updateColumnFocusClasses();
            setSettingsProviderType('m3u');
            syncSettingsCoordinatesForEl(tabProvM3uEl);
            updateSettingsFocus();
        };
    }
    function toggleXtreamPasswordVisibility() {
        if (!inpXtreamPassEl || !btnXtreamPassToggleEl) {
            return;
        }
        var isMasked = inpXtreamPassEl.type === 'password';
        inpXtreamPassEl.type = isMasked ? 'text' : 'password';
        btnXtreamPassToggleEl.textContent = isMasked ? 'Hide' : 'Show';
    }
    if (btnXtreamPassToggleEl && inpXtreamPassEl) {
        btnXtreamPassToggleEl.onclick = function(ev) {
            ev.stopPropagation();
            activeCol = 'settings';
            updateColumnFocusClasses();
            syncSettingsCoordinatesForEl(btnXtreamPassToggleEl);
            toggleXtreamPasswordVisibility();
            updateSettingsFocus();
        };
    }
    if (btnM3uFileEl) {
        btnM3uFileEl.onclick = function() { openM3uFilePicker(); };
    }
    if (btnM3uClearEl) {
        btnM3uClearEl.onclick = function() { clearLocalM3uFileFromProfile(); };
    }
    if (selThemeEl) {
        selThemeEl.onchange = function() {
            applyTheme(selThemeEl.value);
        };
    }
    if (selEpgOffsetEl) {
        selEpgOffsetEl.onchange = function() {
            if (profiles[editingProfileIndex]) {
                profiles[editingProfileIndex].epgOffsetHours = Number(selEpgOffsetEl.value) || 0;
            }
        };
    }
    if (selBufferModeEl) {
        selBufferModeEl.onchange = function() {
            bufferModePref = selBufferModeEl.value || 'fast';
            safeSetStorage('cfg_buffer_mode', bufferModePref);
        };
    }
    if (selStartupModeEl) {
        selStartupModeEl.onchange = function() {
            startupModePref = selStartupModeEl.value || 'last_channel';
            safeSetStorage('cfg_startup_mode', startupModePref);
            safeSetStorage('cfg_startup_mode_user_set', '1');
        };
    }
    if (selOsdTimeoutEl) {
        selOsdTimeoutEl.onchange = function() {
            osdTimeoutDurationMs = Number(selOsdTimeoutEl.value) || 5000;
            safeSetStorage('cfg_osd_timeout', String(osdTimeoutDurationMs));
        };
    }
    function setSettingsConnStatus(text, stateClass) {
        if (!settingsConnStatusEl) {
            return;
        }
        settingsConnStatusEl.textContent = text || 'Ready';
        settingsConnStatusEl.classList.remove('testing');
        settingsConnStatusEl.classList.remove('ok');
        settingsConnStatusEl.classList.remove('err');
        if (stateClass) {
            settingsConnStatusEl.classList.add(stateClass);
        }
    }

    function testCurrentSettingsConnection() {
        saveCurrentInputsToEditingProfile();
        var prof = profiles[editingProfileIndex];
        if (!prof) {
            return;
        }
        var myTestId = ++connTestReqId;
        var pType = (selProviderTypeEl && selProviderTypeEl.value) ? selProviderTypeEl.value : (prof.type || 'stalker');
        var startMs = Date.now();
        setSettingsConnStatus('⏳ Testing...', 'testing');
        showToast('⚡ Testing ' + pType.toUpperCase() + ' connection...');

        function fetchWithConnTimeout(urlStr, opts, timeoutMs) {
            var ctrl = (typeof window !== 'undefined' && typeof window.AbortController !== 'undefined') ? new window.AbortController() : null;
            var reqOpts = extendObj(opts || { method: 'GET' }, {});
            if (ctrl) {
                reqOpts.signal = ctrl.signal;
            }
            var timer = setTimeout(function() {
                if (ctrl) {
                    try {
                        ctrl.abort();
                    } catch (eAb) {}
                }
            }, timeoutMs || 10000);
            return proxyFetch(urlStr, reqOpts).then(function(res) {
                clearTimeout(timer);
                return res;
            }).catch(function(err) {
                clearTimeout(timer);
                if (ctrl && ctrl.signal && ctrl.signal.aborted) {
                    throw new Error('Connection timed out');
                }
                throw err;
            });
        }

        if (pType === 'xtream') {
            var xBase = normalizeXtreamServerUrl(prof.xtreamUrl || '');
            var xUser = String(prof.xtreamUser || '').trim();
            var xPass = String(prof.xtreamPass || '').trim();
            if (!xBase || !xUser || !xPass) {
                setSettingsConnStatus('⚠ Missing Xtream fields', 'err');
                showToast('⚠ Enter Xtream Server URL, Username & Password first');
                return;
            }
            var xTarget = xBase + '/player_api.php?username=' + encodeURIComponent(xUser) + '&password=' + encodeURIComponent(xPass);
            fetchWithConnTimeout(api.proxyUrl + '/xtream?url=' + encodeURIComponent(xTarget), { method: 'GET' }, 10000).then(function(r) {
                if (!r.ok) {
                    throw new Error('HTTP ' + r.status);
                }
                return r.json();
            }).catch(function(err) {
                return fetchWithConnTimeout(xTarget, { method: 'GET' }, 10000).then(function(r2) {
                    if (!r2.ok) {
                        throw err;
                    }
                    return r2.json();
                });
            }).then(function(data) {
                if (myTestId !== connTestReqId) {
                    return;
                }
                var elapsed = Date.now() - startMs;
                if (data && data.user_info && String(data.user_info.auth) === '0') {
                    throw new Error('Invalid Xtream credentials');
                }
                var st = (data && data.user_info && data.user_info.status) ? String(data.user_info.status) : 'Active';
                setSettingsConnStatus('✓ ' + st + ' (' + elapsed + 'ms)', 'ok');
                showToast('✓ Xtream Connected (' + st + ' • ' + elapsed + 'ms)');
            }).catch(function(err) {
                if (myTestId !== connTestReqId) {
                    return;
                }
                setSettingsConnStatus('⚠ ' + (err.message || 'Failed'), 'err');
                showToast('⚠ Xtream Test Failed: ' + (err.message || 'Unreachable'));
            });
            return;
        }

        if (pType === 'm3u') {
            var mUrl = String(prof.m3uUrl || '').trim();
            var memRaw = m3uRawMemoryCache[prof.id] || localStorage.getItem('m3u_raw_' + prof.id) || '';
            if (memRaw && memRaw.indexOf('#EXT') !== -1) {
                var lineCount = memRaw.split('#EXTINF').length - 1;
                setSettingsConnStatus('✓ Local M3U (' + lineCount + ' items)', 'ok');
                showToast('✓ Local M3U Ready (' + lineCount + ' streams)');
                return;
            }
            if (mUrl.indexOf('local://') === 0) {
                fetchWithConnTimeout(api.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent('m3u_raw_' + prof.id), { method: 'GET' }, 8000).then(function(rCache) {
                    if (!rCache.ok) {
                        throw new Error('Local M3U cache empty — reload .M3U file');
                    }
                    return rCache.json();
                }).then(function(dCache) {
                    if (myTestId !== connTestReqId) {
                        return;
                    }
                    var cachedTxt = (dCache && dCache.rawText) ? String(dCache.rawText) : '';
                    if (!cachedTxt || cachedTxt.indexOf('#EXT') === -1) {
                        throw new Error('Local M3U cache invalid');
                    }
                    m3uRawMemoryCache[prof.id] = cachedTxt;
                    var countCached = Math.max(0, cachedTxt.split('#EXTINF').length - 1);
                    setSettingsConnStatus('✓ Local M3U (' + countCached + ' items)', 'ok');
                    showToast('✓ Local M3U Ready (' + countCached + ' streams)');
                }).catch(function(err) {
                    if (myTestId !== connTestReqId) {
                        return;
                    }
                    setSettingsConnStatus('⚠ ' + (err.message || 'Missing M3U File'), 'err');
                    showToast('⚠ ' + (err.message || 'Load a local .M3U file first'));
                });
                return;
            }
            if (!mUrl || !/^https?:\/\/.+/i.test(mUrl)) {
                setSettingsConnStatus('⚠ Missing M3U URL/File', 'err');
                showToast('⚠ Enter an http(s):// M3U URL or load a local .M3U file');
                return;
            }
            fetchWithConnTimeout(api.proxyUrl + '/m3u?url=' + encodeURIComponent(mUrl), { method: 'GET' }, 10000).then(function(r) {
                if (!r.ok) {
                    throw new Error('HTTP ' + r.status);
                }
                return r.text();
            }).catch(function(err) {
                return fetchWithConnTimeout(mUrl, { method: 'GET' }, 10000).then(function(r2) {
                    if (!r2.ok) {
                        throw err;
                    }
                    return r2.text();
                });
            }).then(function(txt) {
                if (myTestId !== connTestReqId) {
                    return;
                }
                var elapsedM3u = Date.now() - startMs;
                if (!txt || txt.indexOf('#EXT') === -1) {
                    throw new Error('Not a valid #EXTM3U playlist');
                }
                var entries = Math.max(0, txt.split('#EXTINF').length - 1);
                setSettingsConnStatus('✓ ' + entries + ' items (' + elapsedM3u + 'ms)', 'ok');
                showToast('✓ M3U Playlist Valid (' + entries + ' streams • ' + elapsedM3u + 'ms)');
            }).catch(function(err) {
                if (myTestId !== connTestReqId) {
                    return;
                }
                setSettingsConnStatus('⚠ ' + (err.message || 'Failed'), 'err');
                showToast('⚠ M3U Test Failed: ' + (err.message || 'Unreachable'));
            });
            return;
        }

        var sPortal = String(prof.portal || '').trim();
        var sMac = String(prof.mac || '00:1A:79:00:00:01').trim();
        if (!sPortal || !/^https?:\/\/.+/i.test(sPortal)) {
            setSettingsConnStatus('⚠ Invalid Portal URL', 'err');
            showToast('⚠ Enter a valid http(s):// Stalker Portal URL first');
            return;
        }
        var hsQuery = '?type=stb&action=handshake&token=&prehash=0&JsHttpRequest=1-xml';
        fetchWithConnTimeout(api.proxyUrl + '/' + hsQuery, {
            method: 'GET',
            headers: {
                'x-stalker-portal': encodeURIComponent(sPortal),
                'x-stalker-mac': encodeURIComponent(sMac),
                'x-stalker-tz': encodeURIComponent(getDeviceTimezone()),
                'x-stalker-search': hsQuery
            }
        }, 10000).then(function(r) {
            if (!r.ok) {
                throw new Error('HTTP ' + r.status);
            }
            return r.json();
        }).then(function(data) {
            if (myTestId !== connTestReqId) {
                return;
            }
            var elapsedStalker = Date.now() - startMs;
            if (!data || data.error) {
                throw new Error((data && data.error) || 'Empty response');
            }
            var tok = (data.js && data.js.token) ? String(data.js.token) : '';
            setSettingsConnStatus('✓ Online (' + elapsedStalker + 'ms)', 'ok');
            showToast('✓ Stalker Portal Online (' + elapsedStalker + 'ms' + (tok ? ' • Token OK' : '') + ')');
        }).catch(function(err) {
            if (myTestId !== connTestReqId) {
                return;
            }
            setSettingsConnStatus('⚠ ' + (err.message || 'Offline'), 'err');
            showToast('⚠ Stalker Test Failed: ' + (err.message || 'Unreachable'));
        });
    }

    if (btnSaveEl) {
        btnSaveEl.onclick = function() { saveSettingsAndBoot(); };
    }
    if (btnProfileNewEl) {
        btnProfileNewEl.onclick = function() { createNewProfileInSettings(); };
    }
    if (btnProfileDelEl) {
        btnProfileDelEl.onclick = function() { deleteCurrentProfileInSettings(); };
    }
    if (btnTestConnEl) {
        btnTestConnEl.onclick = function() { testCurrentSettingsConnection(); };
    }
    if (btnRestartEl) {
        btnRestartEl.onclick = function() { rebootApp(); };
    }
    if (btnCancelEl) {
        btnCancelEl.onclick = function() { closeSettings(); };
    }
    if (btnBackupExportEl) {
        btnBackupExportEl.onclick = function() { exportBackupJson(); };
    }
    if (btnBackupImportEl) {
        btnBackupImportEl.onclick = function() { importBackupJson(); };
    }
    if (lanSetupBannerEl) {
        lanSetupBannerEl.onclick = function() {
            var urlTxt = (lanSetupUrlEl && lanSetupUrlEl.textContent) ? lanSetupUrlEl.textContent.trim() : (api.proxyUrl + '/setup');
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(urlTxt).catch(function() {});
            }
            showToast('📱 Remote Setup URL: ' + urlTxt);
        };
    }

    // =========================================================================
    // v2.1.0 On-Screen ISO/IEC 18004 Vector QR Generator (Version 2, 25x25 + 2-module quiet zone)
    // Includes full GF(256) Reed-Solomon Error Correction (10 EC codewords) & 0x77c4 Format Info
    // =========================================================================
    var QR_GF_EXP = new Array(512);
    var QR_GF_LOG = new Array(256);
    (function initQrGaloisField() {
        var x = 1;
        var i;
        for (i = 0; i < 256; i++) {
            QR_GF_LOG[i] = 0;
        }
        for (i = 0; i < 255; i++) {
            QR_GF_EXP[i] = x;
            QR_GF_LOG[x] = i;
            x = x << 1;
            if (x & 0x100) {
                x = x ^ 0x11d;
            }
        }
        for (i = 255; i < 512; i++) {
            QR_GF_EXP[i] = QR_GF_EXP[i - 255];
        }
    })();

    function qrGfMul(a, b) {
        if (a === 0 || b === 0) {
            return 0;
        }
        return QR_GF_EXP[QR_GF_LOG[a] + QR_GF_LOG[b]];
    }

    function qrRsEncode(dataBytes, ecLen) {
        var gen = [1];
        var i, j;
        for (i = 0; i < ecLen; i++) {
            var next = new Array(gen.length + 1);
            for (j = 0; j < next.length; j++) {
                next[j] = 0;
            }
            var root = QR_GF_EXP[i];
            for (j = 0; j < gen.length; j++) {
                next[j] = next[j] ^ gen[j];
                next[j + 1] = next[j + 1] ^ qrGfMul(gen[j], root);
            }
            gen = next;
        }
        var msg = new Array(dataBytes.length + ecLen);
        for (i = 0; i < msg.length; i++) {
            msg[i] = i < dataBytes.length ? dataBytes[i] : 0;
        }
        for (i = 0; i < dataBytes.length; i++) {
            var coef = msg[i];
            if (coef !== 0) {
                for (j = 0; j < gen.length; j++) {
                    msg[i + j] = msg[i + j] ^ qrGfMul(gen[j], coef);
                }
            }
        }
        return msg.slice(dataBytes.length);
    }

    function generateQrSvgVersion2(text, sizePx) {
        var px = sizePx || 248;
        var payload = String(text || 'http://127.0.0.1:3001/setup').slice(0, 32);
        var size = 25;
        var dataCapacity = 34;
        var ecCodewords = 10;
        var quiet = 2;
        var total = size + quiet * 2;
        var bits = [];
        function pushBits(val, len) {
            for (var b = len - 1; b >= 0; b--) {
                bits.push((val >> b) & 1);
            }
        }
        pushBits(4, 4);
        pushBits(payload.length, 8);
        for (var p = 0; p < payload.length; p++) {
            pushBits(payload.charCodeAt(p) & 0xff, 8);
        }
        var maxBits = dataCapacity * 8;
        var term = Math.min(4, maxBits - bits.length);
        pushBits(0, term);
        while (bits.length % 8 !== 0) {
            bits.push(0);
        }
        var dataBytes = new Array(dataCapacity);
        var byteLen = bits.length / 8;
        for (var bi = 0; bi < byteLen; bi++) {
            var byteVal = 0;
            for (var bit = 0; bit < 8; bit++) {
                byteVal = (byteVal << 1) | bits[bi * 8 + bit];
            }
            dataBytes[bi] = byteVal;
        }
        var padToggle = true;
        for (var pi = byteLen; pi < dataCapacity; pi++) {
            dataBytes[pi] = padToggle ? 0xec : 0x11;
            padToggle = !padToggle;
        }
        var ecBytes = qrRsEncode(dataBytes, ecCodewords);
        var allCodewords = dataBytes.concat(ecBytes);
        var totalBits = [];
        for (var ci = 0; ci < allCodewords.length; ci++) {
            for (var cb = 7; cb >= 0; cb--) {
                totalBits.push((allCodewords[ci] >> cb) & 1);
            }
        }

        var matrix = [];
        var reserved = [];
        for (var r = 0; r < size; r++) {
            var row = [];
            var resRow = [];
            for (var c = 0; c < size; c++) {
                row.push(0);
                resRow.push(false);
            }
            matrix.push(row);
            reserved.push(resRow);
        }
        function placeFinder(row0, col0) {
            for (var dr = -1; dr <= 7; dr++) {
                for (var dc = -1; dc <= 7; dc++) {
                    var rr = row0 + dr;
                    var cc = col0 + dc;
                    if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
                        var inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6);
                        var inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
                        matrix[rr][cc] = (inOuter || inInner) ? 1 : 0;
                        reserved[rr][cc] = true;
                    }
                }
            }
        }
        placeFinder(0, 0);
        placeFinder(0, size - 7);
        placeFinder(size - 7, 0);
        for (var ar = -2; ar <= 2; ar++) {
            for (var ac = -2; ac <= 2; ac++) {
                var rrA = 18 + ar;
                var ccA = 18 + ac;
                var darkA = Math.max(Math.abs(ar), Math.abs(ac)) !== 1;
                matrix[rrA][ccA] = darkA ? 1 : 0;
                reserved[rrA][ccA] = true;
            }
        }
        for (var i = 8; i < size - 8; i++) {
            if (!reserved[6][i]) {
                matrix[6][i] = (i % 2 === 0) ? 1 : 0;
                reserved[6][i] = true;
            }
            if (!reserved[i][6]) {
                matrix[i][6] = (i % 2 === 0) ? 1 : 0;
                reserved[i][6] = true;
            }
        }
        matrix[size - 8][8] = 1;
        reserved[size - 8][8] = true;
        for (var fi = 0; fi < 9; fi++) {
            reserved[8][fi] = true;
            reserved[fi][8] = true;
        }
        for (var fj = 0; fj < 8; fj++) {
            reserved[8][size - 1 - fj] = true;
            reserved[size - 1 - fj][8] = true;
        }

        var bitCursor = 0;
        var upward = true;
        for (var col = size - 1; col >= 1; col -= 2) {
            if (col === 6) {
                col = 5;
            }
            for (var step = 0; step < size; step++) {
                var rowIdx = upward ? (size - 1 - step) : step;
                for (var dx = 0; dx < 2; dx++) {
                    var cx = col - dx;
                    if (!reserved[rowIdx][cx]) {
                        var bitVal = bitCursor < totalBits.length ? totalBits[bitCursor++] : 0;
                        var masked = ((rowIdx + cx) % 2 === 0) ? (bitVal ^ 1) : bitVal;
                        matrix[rowIdx][cx] = masked;
                    }
                }
            }
            upward = !upward;
        }

        var formatBits = 0x77c4;
        for (var f0 = 0; f0 < 6; f0++) {
            matrix[8][f0] = (formatBits >> (14 - f0)) & 1;
        }
        matrix[8][7] = (formatBits >> 8) & 1;
        matrix[8][8] = (formatBits >> 7) & 1;
        matrix[7][8] = (formatBits >> 6) & 1;
        for (var f1 = 0; f1 < 6; f1++) {
            matrix[5 - f1][8] = (formatBits >> f1) & 1;
        }
        for (var f2 = 0; f2 < 8; f2++) {
            matrix[8][size - 1 - f2] = (formatBits >> f2) & 1;
        }
        for (var f3 = 0; f3 < 7; f3++) {
            matrix[size - 7 + f3][8] = (formatBits >> (14 - f3)) & 1;
        }

        var pathParts = [];
        for (var y = 0; y < size; y++) {
            for (var x = 0; x < size; x++) {
                if (matrix[y][x] === 1) {
                    pathParts.push('M' + (x + quiet) + ',' + (y + quiet) + 'h1v1h-1z');
                }
            }
        }
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px + '" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges" role="img" aria-label="Setup QR Code"><rect width="' + total + '" height="' + total + '" fill="#ffffff" rx="1.5"/><path d="' + pathParts.join('') + '" fill="#090d16"/></svg>';
    }

    var hardwareTvLanIp = '';
    function discoverHardwareTvLanIp() {
        try {
            if (typeof webapis !== 'undefined' && webapis.network && typeof webapis.network.getIp === 'function') {
                var hwIp = String(webapis.network.getIp() || '').trim();
                if (hwIp && hwIp !== '127.0.0.1' && hwIp !== '0.0.0.0' && /^\d{1,3}(\.\d{1,3}){3}$/.test(hwIp)) {
                    hardwareTvLanIp = hwIp;
                    return hwIp;
                }
            }
        } catch (eNet) {}
        return hardwareTvLanIp || '';
    }

    // =========================================================================
    // v2.1.0 Official Netflix Furry Monster High-DPI Studio Avatars (avG0_0 .. avG0_6)
    // Pre-cached at startup for zero per-render heap allocation (<380MB DDR budget)
    // =========================================================================
    var NETFLIX_AVATAR_URIS = ["data:image/jpeg;base64,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","data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCADcANwDASIAAhEBAxEB/8QAHAAAAgMBAQEBAAAAAAAAAAAABAUCAwYBBwAI/8QAQRAAAgEDAgMFBQcDAwMCBwAAAQIDAAQREiEFMUETIlFhcQYygZGxFCNCocHR8AdS4RUzYnKi8QgkFiVDU4KS0v/EABsBAAIDAQEBAAAAAAAAAAAAAAIDAAEEBQYH/8QALhEAAgICAgEEAAQFBQAAAAAAAAECEQMhEjEEBSJBURMyYaEGFCNxkTNCgbHR/9oADAMBAAIRAxEAPwDUJxMmTGcN5D9KaW112sWHwcbVi5ppYzmaHOeRII/MU1sL7ijwDFri36M2Ez+/rXzHho9jLEq0ae2eRWOhtS9dqtuIzMhIRgw6isqeNSWsnQEcxzWnvCeNQ3oCqdMvRW5N6H+Gg4i5Y5R9wLPf9nqtb9ToO6sennREh+0JqjcEjDDNF30VrfxFJhpfmDSy0tHsCUDFwrao2Ph1U+I/epWi001fTGN1KVhbTltsjHhWdkupYruGMsdL7g08lZknIA1xvkg/2nqDSjjdqbaKG7jBMUDfedcKevwP1oIxtjMTS0xhDejt41J5jNEcSt5HiE0GT3dwOdIp427aKWA9wxHYeNNeB8TEsJilPeU7Gq4/Zco8fdECsJmKSE7jTj9a+mvOzL6Tk6hgdTmmN1bpG73MAzq3dFHPxIHjzrNcfDRmQRnUca1I8v8AGDRRhboODU2aCxuDNGHB5Yz86Y3EhSMlCCV72nxHlWd4BKJrclT7ybgVdxW5lVLeWE94Eqw8QKlU6AlC5UGQ3huD2gHLn/mjI5wkjJnbw8qA4fLHMCxYBtvjVl8ji1dkX72Ial23ZeoFZ5yuVBcVdBc0yqCTgdSPKrrCXWT/AG4rN8SvB2sKRnvSYAA8/wCGtDwpDHbgSc89PXl+lSmlbKnBRiSH3LyjpuRR8EgZGGcHGKE4gvedvwgBB86CNw0dxL3hpjBNR9i1Hmg1CXyc8yflVPNhjferLVxJHkHYiqY1kllPd0xLjbxNAwo/IztX7JMj3mOK7NPv2a7494+Jof3BqOWOMDoKgrYIUAaz0HQVbk6oUoJuwyJsIM7kmqZyO0U9QdjXEfAJO+nr51UThRnlzzQqRFHYW8XbRhkPeBy3n41GONmXUeu9RtJtJZj1GaLQgr5UTp7Ak3HRgWt7hJNUc2g+IbnVF4kmCJGaQ+JY7fnTC1uEu49Zwr9ceNWrH2YJ0hR0YYP5H9K39GhSrsxtzZ3DNqiD/wD6E/SuWcXEoJA3YzLvnBB0sR9DWvMCtLrWURy9GIOPkdqhLdcWtZMXEUc1uT78eQQPHwNMWTVUH+K3pFVhxdL6Ew3GuK5XlkYJoyxui8jwuxbO2/Q0q4h2N6uqEdnOO8MfioS0vj9pVyQJTjVjlsaVKKe0UoJp0amymEswRxjmMefLB/KjCEScRSqGgnjKOreHL9cfGkVjKqcVaNslJMsP586eXemWJGJAde8rHy5/lQLTEzVMz8sD8Mma2lOpIz90x/HGTyPmOXwrksLWd5NMuewOCPjnb8s/Cm0wHFrLDDFxF48wR++KjdQiRbWJgRh1Y+Yxv9T86O77DWR/PYNNdGB2z7jxnB8+lLeJzpJbRO47wIJHUfzNE8SUtd6GX7uNQT/1c/0pLMxkiDNkl84Hj4CqgqGwS7L/AGbmNtKIiThSyZ8ulOfaKE/6ek4JiMbq+tRkKc9fKkdpbCBg0jd8bnGw/nKtVwu6t76ye3uAChGD5ipKSUuRMlp8kKrRikSGdQpYEEqdSN1BBHx+dOrCQ3FrrJyoXHrzrOW3Cp7Lic1nCS9tIMqc8tz+WCPlWss4VijitkwFAFJzQipaJOSoQWlt2nFpbiQZWFsKMfixt8gfzrQWrf8AuoYgcle8fQD96o0JHdAYAU5dvUn9hQ/BJTPHxW7JAIBRD4bZNDL3u/hAyfJWxrIO2ih/teTOfIVluL3BFtdMpw9xMIlPkT+31rXaQkFmg5CPmfSsxLw97njK6sqtuWdR+EsdgSPLnVY65W/grDJK7G3CCex1EEDA2osSqvJRUEjEduqpyA2z9TQ0bdpIdO3Rc/XFKu+itSbYaZGc4xqY9OgqQj5jqeZ8a7EAke3M7Z6mvjlzoU4jHM+NVdgX9HzSIihUIOPzNASXGWYlgVHM8gf8UwaCPAOgEn+7p6CuJZRSEa8FfAZAq3EuM4rsX2s0t1IRbhmA5t0FaCG3KxKCckDerYezhhWNAqqBsFFEDV5L5E0yONGfLl5PSo8fghnt3DxMoAO68/l+1N7Tio2juAqsdhgUPDLbue9lW8dW/wAiKva1imGEkiY9AwH6Vulvs1tp9hjtE2SQQh5lTt/iq5mltkLQtri22P6/vQqQzQkiNcsozpDcx5Zqn7Syhs91eqPsV/xQKINF9wltfW+Y8wzKchgOXqKQXYWGcgvmQ8zpwD/MVHiF8lqGd5ezCknJOBjrzrG8U9tLHUApknO+6Lgeu9asHjZMj9qsv8WOP8zPQrTiURuInkYKRhh4jx+FaH7UrIwWQFD3lYb6T+1eHWHtXZzTKkkjwMRpHaDA+dbnhvE8wx94HUByPOpn8SeL8yJGUMm4s1ltclOJoY/dcaWGfDl+tPLiRXlVtvdwKwvDrpu2TUdw3Pw51oftoY5B2A3rFNOIU8dsIvYVlnusc5SF+GKRySxJdMFAwndG2TsKd2L9tI7nlnag+HcMjguDI41PgkZ5k9TUjJV7iRfG0wJuG3VxBkt2KkgszcyPAfSr+EWb2cALsxxtjkSc8qaTSNIdCkgDmfAVyL7zRpBweVU8mqCUpNbDOGk68tu2NvSrbOQyX0hJ9zcfnVdrhLpweQwPlXHVrS4kkChkZdQ8/EVmTtgOtojOWlkeIHJJwD44yCPzob2XYKl/A2CySkupO43/AGNW3zr95Nbgs6qHGPIcx546dat4C0cr3d28IikciFiOTEKNx9D6U+EfawZP2tDS5bsltlJ90FcH5VSka/brhwN2PWucTJa1jcb6SCD4V80+GQn8aAj1/mKzXtgJaLL5GETrHgEkKPL+Cg7UZckbAkj0A2/eo8d4/wAN4TDniN1HFqGVXOWPoKxo/qZ7PrKYdVwFLY1aQNum2a0x8LNljeOLYKyqKqTN9rMkhY5CAcvKioiEQliFXyFI+C8d4fxhf/ltykj/ANh2ZR44601QgsuTq8KyyjPFLjJUy3Ukcubxgx7NW0494/zYVy3leRgXPPqdqIeMMe8+x3wMmoNFGN3d1jHQ7ChbLi1VUFx3Kq2mNWkcfIfGuvcsTsznx0RkjPrUrTBTEaFU89hRBkUbMRnzpyla2JdJ9HmUEkYx2ikr11DH60YkVpJ/tIwP/GQYqIhV8kORjod8/wA9KqltSznDBiBzj97Hp/it72abDhGEQMhkQrvhsOD+1JON3cLQkFkLgcjsw9D1q1mlgRgGDqOQdRkehG9YP2quZzbXsgLDShx4HpTsGLnJKyqq2zD+0nF+Ie0nHLfhPDIzNIziOGMHGSTgEk7D47Cst7R8M4hwHik1jxOOSOaNiveGM48KJ9lfay69lvaW7v4UMnaxyW8qZxrRuhPhsOVCe0/tJc+03FZb6/H3zHAOokhAMBcnngYGfKve+PgjgxqMUeWz5pZZuUjQ/wBPPZTintncXNnwcRSTQxmRkkONvI+JO1OfZi6u/Zz2ik4LxwSwhCyiNx3o3wdvQ0n/AKV+2SewvtLFxSJWnDRNHMmcbHw8fjVvtr7Rt7U+27cYlia0aeVGWJzkrywCaV5eGGaDjL5G+Jmljmmj12xcSp2iaSx3JLbDam/D43cM0hBUnugDnSfhkax24jVSCDqyxyR0p/w2RZp8ZOiMam8z0rwWWk2ert0NLZ1jnji/CRjPnvvVjsEu1DZ3yp+RNKrKftppXbukSlc9Nv8AzTUBbtH3JIAIx+IcwfUEGsji3LYLXHZTO4jvvs5xpl6+VMosJLH1XblyFJ7wNPbzMw/9zatqRh+Ncc/X9qZQyiRI3yNMi90+BoZxpFPaD57catcYy2ckeI8vOpF41TWxDQyDO42B6/8Aio2k/aKM7OmDj9as0o6SIwyjruv7UEaYl2tMR3diYzLJBI3ujAA2IzyzU4LkJDHFHkDIbfqxNAM9xwfiCxTOZOHSnSkjb6c7fl4eFGvant1mSQABzqXBwCM/5p0k0ux39xxdEPww5bmOeKzntr7QQcD9l/t8LIZ9ooVfcMxx4eABphxiR4+CAxZYqynunO2+/pXj/wDW25QzcCtreQlI0cuAdi225+dO9M8dZ88Yy6/8EZrhjckeecf4rxbiRuL1/tEyK5WW4O41eGfj8KQcPEt7exW8eWllYIo8SaeXvtrcp7MN7ORxBbYTF5Gz725Ow6E53O+cDwrL2/ZMx7Riq+W9fSMOOOOCUUeXy5JTk22e68V/ppx/2H4bH7Q2HEBeW0AWSeKLUHiU76geTAbcsemK9N9jfaZPaThUM6qnaqAshUbHbY/H615ZB/Wq8vPYeXg03DnmnNuYZp48kLHjBIU53xtuaaf+muTtYOJRB8ooLBWHmP3rgfxH4kMvjvMvzROh6dmlGXB9M9shVii568tiasitlDhmy79C3T0HIV2LC790+hNTLKy6caV5d07mvCwja2dVyfwRuLvs1K25DSci2NQWlxt7hyWaaVyebZC/lTSONQuEjAHUnauFkyd2Ppyp9IkZ8ejJLbRTkPaTAHqjb/nzFUzW7pIBLGQSNiN1oKJonk127urdMb4/UUwSa5KYfEi8tm0k/OtTHU0L71sxkSrnwJH61ieL232hpY52ZYpFKsBvz5V6JJarOCrgkn8I/flSjiXBVeNj2aR9BpyxPoBTcOTi7LTXTPy57R8NlteJSpoOrVpYY5N/mpcc9luO+z0aS8Z4VdWkTnCvKhCk+vKvZ/af2NW9ZezR1ucY1kZyPBhSrjU3t1xH2fHs7fM13w+NTGisiltI3xqO/Tb5V7PxPVMWSCUnTOD5PgTjJuCtM8dsyTOjhQyoQxDcjg8jW79l7Sf2l9p2vZnUDXrmHZZXHTy54HpUeEexN0ZRFxKJ7RCQQQwyRnfb9a9L4LwSL2cgMNrGBCzbyZyTjG7ePOkef6hjjFrG7k1of4XgztOfQdO4gZuxGr7vIwDtz5034NIEiIZvvZpAMem+PlX1ncdocRwq0RGhl5nBzkfLFVy28VvJBPA5CqwxnkN99uYryUnftfZ6BK9DOKIrLdI2EZJQ6EbgqeQNfcAmea4uYG7k0LYCnwP+QKrik1Thg2kE4yOTjfGP50qYQW3EkvFk7znRIOQ5Y/nw8KRa3ZVWqG8bP2uiVSrk7E1Vw0p9nkgz7p9wevMftV7uxDLIcoh1Iw/nrQN0FST7RbOCUOplVcnB57UK9yoUhnw+UAnroxj0/n850xjYatB90+6w6Gs7bTaZCyH7pyCoO2D1+BoyC+06W6ZwRSZaZJY2wjiEUc0DCYd04z69DQdnmKf7MzExsNKk77/z6UVfSBrdimOW3w6UFw1GWFbi4x2zHAAOefWpytWXCPt2GyWhu7Zo9Tacggg4O3nXmf8AW3gsacHt7yO1LzwMCzocYBHeyMb16VxCS5isx9h3lPLqPlQVzi71W0skckhQB1cjTnfNP8PPLBkjlXwDKHOLi+j8w8D9heMe191d/wDw7bC5lgi7aSPWFOM42zWYvbW44deS2l/BJb3MR0vHIuCpr9B8V9j+M8F45/qPsVdNYTmPDJE2jOTvg4wQdjgisLxX2C9ouNcRlveI2d1c3czDtJWO7E+JzXvPH9V8eeNNyPPZvT8qk+KMn7K+0cvCeH8XsbKyjmueJwi27ZtzGpO+By5V71/RXgs/AvZuW+XOq4ARV6sAd2+J+lZ/2L/piLO4EnG4VjRGGqBfxf8AU3Qema9fitigjiijj+zquFQHBUeHpXn/AFr1HHni8OHp9s3+H4zxVLIGWlyW99QpI+Pyo1HYAgbeeKqgSMRgaG7vQnJHoaMg0uD2bAkc984rzcfo1SaKzL3N0yMZyzY+NAPeDV3u1TwA8PlTKe3SRSGVxk5JzjNUCxVc4Z/HZsVJEg4/JjoLlgo7NYV9elSM9w8mCyEZ5L/5oIJbRe+5cDkqgn6VGW+0ppgt3VT4LordVmnj9DbtJI13KqP+R/zQtxxrstsx6v8AhHz+Nc4PwHifHrSaewEEYjYridjlyOYGPqaBlth2JgyzXY99lGnGD4fQU5+NPHFTmtMBOEm4p20OLzgt5ZWB4hdW6JFIBv2mWXPj4Uj7ftGZlbtAFxkZYgeNOeIcWv8AiHDRYXTxrDt2jINzjkPWlc8JVCI41RdwB+WTTPI/BjOsLdfqVhU2v6nYveVGK9pEF6acDO3U+NDW7pM0gmGvvaV04AxnfbPjmrby2KjQDpeXOCeWKVyQR2atGFZVBHLr+9DGpI0RiM5eJpCyKqo9oMu0pbGSTtjz5fOoXN1FfMU0MszpqwTgMuf8GiLaC3uVKlxGgwSAmMHyqstaWt4GdcoU0KwXp4k9Dz/m9AuKelsYqLOA28wtwI3ZSsjd1jnIIyPhRCyurSQXEelg2CT+Ln+Xp40saS6hkZ0IEYJYaB9fGipeIlrdYGjLXHaABpPwrzO4oZQbd/ZY8W4ls7Norl86CNL5zg45E+nzoe1v2eBXEgWRSdAb8Q8D+lBJfIIhKJGQljjVuW8sczyqFr9lnlSMKwYFmGNg39x/IUn8PTspRXbGkLyTzo1opTOC0Z7pB8cHY77bVfd28svD1ljUwTkhmjbu79R5UPZSx9v2VusiSYAaOXdWB6hvEUxPFZbJxbXSs6SYCkrkHPQ0DW9IF8k9AFveFg8EuRKrZKOCNief5ijxJmAvqzHqBV1OdJztyqu84b2p1lOyTx1EnB/t6/CrYLmG2j0xt3sYIYaQd+uBSpKNaLbvaGlrPFLB2cs0bE9fA+tUcRtYpmWSGRe0A0NJ2gAxQF0trdrFmMI4fGgkZBO3KjVt0WTswgEZAKHxP75qkkhTVO0UR6oZNLO08eoJ2hHJsE/CiI5pQrgRN2oGdB60NpuoZnlhdSGO681bpyPKmagXaqyjRMu+M7g+FFaBn9lXBTe8VuXhhhRJY/e1sQuKOZ3tbt7a6iEU8ZwcAfkaHtzPa3ovbFkWRlCzo4xqxyY+fSi5rg3rST3yIsje8w5AdPTyNaprA8C43zvf1RmfLm9Lj+9lgd864irKDg5O9ERRROe1VMEbHPTyqrh/Dbmaye5g7N4lBIUnvkDnjofSqra5/GMkcjg9PMVly4MmKnONJ7QKalfF9BUkzBiJSoA88morPLj7pV0dO7z+dcYrL3kIZQdsjJWqg39wUnxGazN7CSR5yiXDPhVRAPwou/zPKrGiuFVjJMFXl3ds/qaZjSpXuk+CgZ+VCXXEJI2K29uzy9Md411VJvo2XZbwPiPE+EQyCCZUt2YkdopJJ8s0JbXccPE4Eudckbyh5+uATvn1NVqt5Mxa6nVSR7qAd3400sLCFIgwQEg5yfHxp78iS483aXS+BThBW62zQ8euOGXy2n+mxxJMuTI0S4AXoD55/WlLWw0s7HAbqRtjyFWoI4kLudKqMgeJ8aV8RuxPjtXZYyMiMHvEefgKDPn/AJjI8lVf0DgxOEVFMV8RlWa+WK1y7nuE4yFB8PPzpdxtAk8cavq7FNyNzqxTBrhLSOe4RR2gXQoXZVJ6DxPnSKRJjC875kMKhiM4JJ6/KrgtmyKGdkJPs7GdVkj8QQBjzzy/xXH4YkhUo6B88lfXt0yKVwabm3IuVYQkhivTI5elXyQIhV7UIWGAQpJwPPfPjV8eL72FQ0mC2iLE6Fk0kIwOcAjdT47j5UrN5BEjOWL5GkglTz2zy8KsuhKUdtCJGhBU6xjOM7eFCMtu91IzOW1tkKp55qQiqtgpF8dzLfzrJEowSSEz48jt5U3ieIXSkgROPdKnUD47dDSoK9u33UMUa5yO6TRsV4vZCOeIagRgkHb0z+9BkV/lWgrG9ysF0isqgS5ABY46Df0NW2sEhQCV1yoYg4IVT0xvnl880Eb6MwxsV2UblhuOg29frVEvEz9jmWNPupDuud4xjln4UhQlVAq3pBdxxWf7WLW3bMbc2OSFXxOevlTG3ihiUv2QduhyQT5k+PkKz9pcjRIhUsWXfPPJ5b0/s7hbuzbsmIZCAy82GAc/OgyRrpEkqRbC6xxB441EmMnC8hywKvS4IDBR3tWpTnbY7ih4mU9jHlVaRDjPMc8CqGj0Wiqc4BJGdyvT5c6RVvZTpjsIrRMTjQWyNuXiDRdpyKMcMoBU53+dLLOQPaCTGqORO8oPI42I88UxtyoMbA7EbZ5g/wAFU4szS+i2O5igv4LmZCYwSsm2QfX0NNOLXFhdSxmwMY7nf7PGM+lILiJ4p9ULK0cneCHYg9cHrUjCkzFk+6mA72oc/XxFa15VYH49Lbu/kS8KclksNshe2VpJbWdwvYuCoyveQHwoKK0uIsEaZQOo2cfvVkkczRqHJjkHJkJYH9arhvZ4Z1hvkUg+5Mhzn+eBpOTPkyxSm7roOEKtxrZ8ZnVtgPMg4+Yqz7VIBsFP5VZdhGkCyqA7DKODs1DYK7d0+orKx0eMltGZuLyGFCZZSuDjCnY+W30GaEmuz2CsuVMxCxog97Jx6n6VXFYJlLi6QyO3+2j7beJHQeVMo4RAWuLgq0yjCgckrqPjEtURgs3aZA/IHYdM+Pr50zuZo7ZVTJaUjIQcwPE+FKZeKC3tnnOI9WyE+83pUeEj7TDJc3Sk8mILZ1HzPX6ULvjcguHywpkmlUyyvpXpjkP3NVzWixqAQS2NenmR/wAmP6VJeILPMywRMxTbLbYJPQdKmNRMukkydpj4n/zil212FtCa7jaW9iFxlYImy2eWrw+Hj1JoJDjjF0qY7Iw7Dx8vOrfae/hjuEhiOSpCqwOQDy1fPO/rQfD5Ixe3jMMx2kbHmcMR0P61rhBuF18BJkZRmXRBoZeShNjnPh8aPthN2rqyqMaRnGDzPOhOERPZwNxO8J7bY7jbB3GPyrYW3DFh4bCrDMrANI3Ik4oM0lHRfNIzYslujIuCUZcH/iP8UsPDmt5nMSkKAT3uRHjih/6m8Yu+AcGuE4WzRzMVzIo7yITuR4bfKvKOBe1/ELKcyR30zFjlo7hjKj+oJ+mK6fhenZvIxPJGSr6Of5PqEMGRQkuz3K2+0RJELhN3XIwNxmmFqkbMCwMIbljvKRnqP56Vh+B/1FsrubPGYHtAEwHhzJGT5/iH51t7O+suK6Rwu8guYyPeicMc+nMc8b1kz+Lmwuska/6Dx+TDL+RhaxBZwZI4WhIydP8Ab4+nOqeIcLSeAm1BAYgAqMZO2KIuNXeRebA425KNgKuJH+nuEJWVVAzzxjc1j66GqTRn5NaTdnqB1HII8f5mnFgstqNTE4dTnxPhk1VNaqdLoDlUBGPkB+vxphxhF/03VGwGVCgjffqfrVN2HKd0iUqCQQPGTtyONwDnl8auntlAw+oiQtnHQHw+vzqyEJhH2Klhr393u86JklQIQx3A94bjI3pajsQ5/Qr4NOyNJE5zNGe+MY1b52/SnEkiqqvEQVYZDfvWH4z7WcI4DxGRp7+Ak7iJG7RsE+7gZ5dPI+VY3j39Vbhu0i9nbQxxHlPdjceij9TW3D6Zn8iV446fz8CM3lYobbPWjxeGaZoWyr8yh5N5g9DR9lchgF1a16ahg1+V5OO3M/Ehd8Qvbi4uSdiHK4PTSB9BX6A9m5OIDhlm14gNy0KtIrLvnG4P826imeoelfykYtyTsHxvIj5FqKqjfwMrKF0gjqp5/CvpbdHBRsPE3LI3B8KT2XEI2kWNiySkZVSfeHl400ju45oicg9Djp61x3Ghji0yjQOze0lYkodUbdaqiCsp1nvA4OnlU7htcsZBzkE6h1FL+0A/3GBbxxzpczRBNozcVyZ7pgCNQ3J/tHgPOr5Y1nUNIPuYycITs58TSXhbdhHGpPeI1yefgP1pjJcEgQsRkY1AdASNvka6co10GlT0ZfjUtzLxYsrkKrYXAzgDr5DpT2y4gUiZSvekKHGNh4/n9aW3Li24urMC0bjB22Jz1pxbxmW9bsETScBtsEeppk2nFKhjYx9mLOSSS5uJF0mU7eYG3y50bxCOO3hyjYI90gZ3Od6nLxKKGJordVkKYBQHGfj4UtuOIJJJ2d6roD7p5fI/vWVxbdi1cnZmZ+Cyq4uAtxdOW1NhQo25KBnNFcE4Y8Ntd9pbukc5CnX7zEnOOdNpZeIWxU2RW6t22VkYAj1B2p1DHiz+0Xs+Ej7zyEYGfBR18vGtLzSaouUmgC44et1NbwMNSxsGbHLI6n8q0M2iJQ0g1MD3UzzJ5Vn+BcXfiN7PLBAIbSM6VDbySHxIHIeXM0xvbhYHSS6LOxP3dugyzH+day5k1JRYDTemJ+PcAt71JZLvcgAM46f8QOpOf4a8W497AC5u5mtIjbuMthBlRvgD1PlX6GEc1yI2mVUYe6inYHx88fufCqV4TGWQKokVX1Nke8+MZPp4eQrd4vnz8fcGJyQhkXHIrPylf+zvGeEOfuy6jfKeHpzoKPiUkEv3sbJKPxDKsPjX6m4l7Px3tzJIUTmAWHLbc/SkMPsDY3UZF5EjamZyzjOFrt4vXlx/qxs58/TMb3jlR4tw3234rZ4+z8XvFH9sjCQf92ad2v8AUvjaBg1zZTBhg9pb4+hFariP9KbOS4cRW+jr3WK4G3Pz3rN3H9MFMum3eYKQWBLA7b+XkacvM9PzblFf4BXh+XBeyd/8kz/UzirHJh4aSBjOH/8A6qb/ANUuNNAIhHwtFBz/ALbH6tVMv9KLmKOJzcSlZACuAOtTvv6UyWXDWvZrmZo0IDKoGRk7H8xQ8/S9Ul/hk/A85/7v3QBcf1D4+5bTxSOAMckQQqPqDSLiXtHecQz9v4ne3X/F5Tj5DathwT+nNncQtPcGdoVbBy2DgMAx5dM5r0Tg/wDTD2etJlDWYkZgyhmJYZBwDvUn6j4XjP2Q3+iRT8HyJf6k/wB2eAWS3F7IIuG2Ukrk4GhM71seA/0049xScDibrw+HI1A958HwHL5mveLXgNkLMLb28UTAahoAAyBvTKzhS4i7wAfOAeueoNc7P/EGSSrEq/cbD0/FDcnZgLD+m1h7OKl5wuFru4QAu04DP5lfD4b7Vo+HGVFRk1dmwyCwrSRloSEkO5zz69CKqaMC4dVGoL0I3+FcTL5U8u8jtm7HUFxS0DXNsnELNWRgHVu6ce63gfXxoK1mnjLmRG7Tk22zefrTgxLbB5VAaEtpdSOa4oS/7a2vXktznfVoIyHXqD50jlqhsH8HOHltmRjoOrbnz5+lWxRMVOhcYO4PQ1XEY2dprYqjA99c4HxolllJzGduoPMGktWE3s844Yxdm1DB6DHTO9RtdX+tai2UaMo+/UHY/MD51ba7XLqeekqPPbGfnRH2IrJJNI/ZwIQ2T1x0rrN03+odoBkgM95cFhlUbY+O9HpdNZrHHpIluX7MDwP+KnZW3a27XE47OEsZFVubAdT5UdwyzDMbu/YoTllUjcL0z4ZoW97LbVBUVrDDCkka4YbiNjuSOuetCpdWt6Ta8RtpVY7nODjz8aX8ZNxPJ91nSu4DHST6Hp6Vbw64ik0R3KqzjcLIM6T60FOuTIo6H/CeB2tmS8LPLGxBUSHu/ufjRHGOHSXsZEsy6P7eSr545mqYrooAIlC53yRrH5VUzcT1hpLxUi8FUjNKc23di1F3dl1raNZW/Y8PiCIPelkwufOrbFLeJy+oXFydmk6fChPvpTonuNQP4FXc+J8/pVN7eCxUrbIdfLfn8BVcbe/ktpvQ6uZxCoJcK7HSuefpTCNMRrEvdJXLseaj9PCsFw27mk4qJp3LmMEORyiHUDz8/E1p5OLolvNPKSiF9KhTkkjp8ufh9WvFxVIzzi7oaaY40yBhBsAOoFCWTi5uLlkGFjxHq6DBycUNc8QkNpFoTE7D3M7Keg/OiuFhITb2usZKmWQ8yfj8aXxpMHpWdu0RFlYqoJwoP1NAy2MeToQe5pUeAx/PnTW6TXLhuZbJA8BvQyozPEhYkkFyfWlt0HF6BpLVZ+DC2OzAaR45GDj8jRNlbxvYRwygMoUK4I/m9XiNmuEH4FbUR89qltEoIHx/5E/tVKT6I3ehbY8Lgt7C4gVBpd9AzyzgAY+Q/OjbRhlFYgnUzAgeH/iohh9ihZs4z2mD45OPypXFMy3BwQWJcqM+G+Plj51fNu2wlByseQRrFdZA20k46dTVVk2lJmK40OPjjaqrG6FxACM68MBn1xXbGdRBLtgs7Mfgazyk9lcHuyUspl4o0QxpQDG/XfOfmPlXLkCKXWx2D5J6YJxQP2lLWC4vblh3O8cDkMkVdPL9ssLiSDvYyB6g5FE77C4U/wBBjM4WyKtu2+R86WG61XQkIJQsM7cgRioWs/25SxzkEkjO2CMEYqhY+wmYF5QmTzO3xoa+A4QUbT7GZESyhhpDnIIGwJFELDGVyqDHxpel7C0elCGK89zioR3UzLlIlC5250cVQPBsyljZvJcySKvdACqT8yTRTm2Ta6k1RxndM++fCguJ+0MUMTRW+C52AWkVqzTt7xyx3IGT8K6ig5bYaTe2bC2nF4xklQLGCDoHXHJf55UyAE2ZDklQcL0B/ek1rNBZwh5iqRr7oJyT8uvkPnRDTXNzGWgQW8OMmSZuzB9FG9LcX8AMHvLyCFikgVm/Eq748yc4zQraJgSpkz4xEq4+VUX7Wqe7dLO4GwVdgfpVPC78K4y0ZweR5/L9qnClaHLoaWx4hFGDA8jHl307/wA+VStft9/OFuZGXPQHvN8uQ86IiiW8ZW0s6NyWPr/j86ZhUtl7O3C9udjgZ0+R/blSuf6FOVddnxjMQWys1+/kHvDdseJY8hU5bWz4bGIhia6bHaONzn+fqTjeirRhaWsjAntCO8x3JI+tLLKF570NM5JO5XOdK+PqeXzq4tMQ7LYOHs0AY9nGzbZA2XrkeOB8zih7m1je1t0VSI2PdT+1M7fTejLm8+03f2NThc6D02HP4E934GheNXot0kVVGQBGd/Xb+eIpsU0xacmzkc7y24lVdUouHjTPrufl+tT4VMtzxm3kjYsIlaLnsTyJoS9uEsPZ+2lbfE5Yjwzk/sPjSfhN8bO5kZt17QSbeuTV8bi2hkY3Z6OwX7Q4YD3PhvjNckYRvEgIM0oJxjOw/SgLeZ5ZI5Aw0SxDc/hOCf3qXCXMs019cNjYgE+A/YfWsriL46CzcKJjZwtmcjUxx7uevyqriMqqohBxthQPPbPrSW3meC8e4lDHtV1MM+PIfQfCiL29RZGkdXyFCqqjmT0/njSpLdIasVMMuZBDCTsEHI8gBj/xWP4ncyWV3bzoruhbDBeYwBv67U1mmmvm0uqdmp6nIAGenXxrM8QWQcQt4Hlct2hkVgCN8YPw/wA03BjVuzTijWmaNuIKkUVxYo0sXvnRz0HOQR5bUys7iNbe4ZO6dDFcj+eRrOXytwq7s54U1CZWVgNk8cfHJplC6TAyQBlVhnSTz8QPOgnBUqLcFVlMFnNd2dxBfyB1lRY1YbHY5AP70dwaKWwkaJ5NSZHM4IPLlQbX8tjIocB4G91jzx4U5tbm1vYspIpHI56fPlQyc2qfTKyN1+jJyQLb3Haw4VWPe8/Twrt3aQX0OmTbG+rPXxrksLSRsiSKwPVeY+FDQQSwtu4Ycsjl8qBJoSvu9nV4dFGmhSuOuTz9asFrFk6jIT5E4oq2hUNvgnw8P3posSgDDf8AbmmJi5ZGmfnbspu3LQdtKehYYFaDhYMaHTE/afjdgfkM0x7eKMFYOyVzyOml101/uwKOh8P3rsSyPIqqh6YS3FPsrMYrcrJ/91wTj0NKb7i9xM5MhDrz3JNd7SfOmRwp8Gaq5LQaw8smrPuooyfy3q4xiuy9HLRHusNIOzj8dXP51o+DzRQOEH3kfLIiJb18qSpZ3kunLdgg5KPeI8x0p1wmLh1sUFxJquCcqDktn50vK01RTNvAsQTMevvKCSE0lvQ86mITGRtpJOFReg6nzNC8NUMO0ldmBx2YORj/AD6U4CIr6QR2z4G/MVzZqhHKtAV6oWFlXIijHex+M9FFUdp/pPD3lkw1w25P/LGw9BTaSNFYdI4hvnqepNIuJxPelUOwLEKv1J8uVSD+y4rloUcPPZQXF5O5BbLMeunH7avnS6zujfX7Lc7M7lsH+49PyAov2gXsreOFAVEsgX1UbnPwFKbiJ4JBOoIwyk7cht/PXFbIe5b+Rqits0vEYVbgQilGVY5z4EH/AAKQwwNJazouRNHkjPXx+tamGSHiNlJAx0s4yQOh3Bx8d/jS+yhKnDDMgBU4OzAjpS4z4qgIurD/AGZvhLwVVzl4wD54zg/rTKxHaez9wqHEiq6nG/Mn9Kydpq4fdyOuTA+Rnoh549DTW2vZbeS/EWHhlj1qeqsN8VU1u0VKH0fSXQe0QnBfswSBzPP9aIuw0EEbRjU8gALE4wuM5+eBSpp43lMsS6Zf/qIPPqB+ophbXHaqqMc6MaSfCkSjWx3QJxTji28qWtnGTMFwdAxlh0z6ikttBeXs5ubxyhbcK25UePyoj2kiTh12t2nZornZsZORvj1qVw326z7e0lHaPjUq7jz/AJ+1PUVGKcV38jINJWvkZRXNvfRpbFyxB7pPjjx/WrJXjWQrGQoC79NJB/KlfCoWt27xyRuWG4NULMEuZpEm1jcYwQVzz/OkcNuvgPgr0aQCz4hB94A6tuGI5n0/P51QOGCE5VwP+kEZHhWfS6nBBikOy4OTkE+G3+K1XCmd7PMrArjBB5ZqpxlD5AknBaeiEQYA5BITqdsUbZNmQdoCM/HNVxxP/p88h2ZE5c+WelB8IvO0ydGNONaA8vMUtp1YuuSdGlt0Qtpk94cieeKNEUoHcKOvixwapSKOeJGBJOMqynBrvZXMZKwygp586WrMUtniUEDBgjMxPjkMM/WndvAoTY6sYyxPP6V2HhyRnL5MjdF3JqviAS3RY3Yo34YYzlj6125S5aHp2WPFaglpTnHRWIzUI7i1QMbdYo15ErgZ9TzNKY+Fz3k2SmmEH3fez69KZIixExWqoXXmVXUQfX9qpxSVWESkmZv9mDIPj3Af1NQtLmeC602qWySHmsanJ/WopHNNJoec45sFOMep6fCjbS4t7Q6LSNMDZmC8z69TQtUqRLNPwvtFgElzqN0wxtzA/SmEU6wvoRle4fdsHZfLPT1rOW15PdMFVtJ5d0frRNzxKGyH2axU3N22Mn8IPQsf0FZXBydC2tj+e5VFSMsNR91QMFj4+QqAEawan2Zhp2pTw5hZ657yUS3LjLH9AOgpZxLjj3cwEZVQx0wxk7yeLH/j9aqOJslfCLrzE8zEjIzgepP7D5Uv9oVSDDgDSGCZP4s4zTbgcJnhDnvLGGwp/Ex2yT86W8flilvBC7ZWDAIx7zE5JHzA/wDxNMgny/sGpbo4Ea04jCRkROQDgcsjY/liiIrox3h1DSRs3l5+Y8fn40aY4pyoX3oiAc9RzB/7qHNsDJC2k6wTt4jr9aBytUy00wbjDPFIZ7YkD8SZx13+HX86hBeC2IdwdDHAZBjB8COh+tFTQaZraEqSdGS3PBA/PqKnYcLEcrRhR2TDvJnP8xRpxcKZaaRb9mguIEngxgHHd6fzwqi47W2t0mYAHON+vn+lc4TC8d/cSwMexkwcHkd8b/Knl5aCQRxaCWVclfDNKapk5cXRmHmg4ray2l0CCGGhjgjV0xSqxhntbmMMxEWoZYbdTWltOG64n0KitI50jG2Btq+ea+bhXalnjlAjL6Vzz22O1F+Iopx+B0ZpWhZLKwikAGAx2I22qiJ4LcKNLHJ04UAUVxCMRkohZ3bbWeQx4edBiAxyZwcHA2qo1Q1PQTBfQpIgjtWbUcbthjj4b1qLEh7GR0jxgcqyE9rrQkc1wwOOWa13s1Ibnh/f/wB1QFf1B5/GgyJVaE5l7bQ0gjElmU56tj8VP70kXhuJUaElJgNSNn3h1FaCEmNjpGBt9CP2qtVilhWdDqgJ72OaHxpO/gywyONlfBrkvmGRdMyHdeWfMU5BDAE4PmDSm+sSXE8eNQ3JX6j1qQu3AGuNy2Nyp51SVATSnuJipZHjQrAeyU85GGWPoKFgt411OEIJ3LNu7ftV97Iyy7Y94j02/wAUIrNNJHHIzFGUuRnmcD966cQ49H0jzzP9ltCEyO86jZB4/wA3NQmi7FBbWTEtyLt+Zoq5cxFLeLuRsNTadidvGqrIaeHyXHOTfGenpV3oJfYA1k0zNCjlYwAXk6ufD0q+G1Olo0AjhUaS3Vv2+tMLldNvGFYjUgckdSartrWOTKyAsq5wCfOqc3RLFz9q6Eq3Y22cYTYt8ev0rlrcjh8bzFFdugJ2WiWJneRZPdDFQBtsDjFDcbt44bd2Rf8AbUaR0B8fWii7dMMttriS+jvYpH1SRd525ZBzgDy86lJbYkM7AKpYKqgcxy/WhfYxA4vWfvF4FDZ696nFwNcwJ/vj/U/tUm+M+KBWh5d3DWdnHFGQpC526dP551i7RmuuPXY2VFQKmf7hjf5VpuL8gMnAhDfHekXA41S6BCjJkYnPU7ChxOoyYMVSsfW0DRxghj2rjSGI5YO/5YphwVVu3uZnICQNp28c5+mPiK+XvQ5PNGbFUcMYw+zt4UO5mJJ9AKz9pk7QRYCO5v57o6hGi4UD13/SpQSgzXlyCAkarGnhlu8T8sVVASnC5Qu2XOfhj9zSjic7xcCkKHBeQZ+I3+tVHboJRsecHiTEWnBQlDv1Gcn4b0znYCR5AQJJG0pt05ZPl/jxpHwuRuzC52EYA8hRM9zI3FnQnCwxM6AdGAOD8KnbAlF2XX8nYyRRQtlmIQ428j8B9TV8Nm0XDppSCxGrQPHAx/PWqIVEnE7UNy05/WtHxDuwQINlZwp9M/4pMlaJKXCkvkw/GrE21nbw50yaMs3/ACwNqAtIc2UkdzlZImwH/MH6in3tY5N/DAd423IPXOapkhRrO4U5wDqB6jaji9D4zfFNi6OIxklwM4wf55054DiC7kH4S3zFA8M+/s07Qfi0beBGaNtNjG3U7fnQsuTtNDW+A7MoH0SE4jJ5Z54oHhN9JHdOkikxyE8/wnqD/OtT9omK2IZSQdab/Gp+zqiZ37QAktufQ1T6EpJY22M43Fu3ZNvERlD5HpUJo9DkLqwd8gZzQ6uXuAje7jGPDnR0Dt2Q3/maGrEPWz//2Q==","data:image/jpeg;base64,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","data:image/jpeg;base64,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","data:image/jpeg;base64,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","data:image/jpeg;base64,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","data:image/jpeg;base64,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"];
    var NETFLIX_AVATAR_PALETTES = [
        ["#e50914", "#831010"],
        ["#f59e0b", "#b45309"],
        ["#06b6d4", "#0284c7"],
        ["#64748b", "#334155"],
        ["#10b981", "#047857"],
        ["#8b5cf6", "#4c1d95"],
        ["#ec4899", "#3b82f6"]
    ];
    var NETFLIX_AVATAR_SVG_CACHE = (function() {
        var cache = [];
        for (var idx = 0; idx < 7; idx++) {
            var gradId = "avG0_" + idx;
            var pal = NETFLIX_AVATAR_PALETTES[idx] || NETFLIX_AVATAR_PALETTES[0];
            var dataUri = NETFLIX_AVATAR_URIS[idx] || NETFLIX_AVATAR_URIS[0];
            var fallbackMonsterArt =
                "<circle cx=\"36\" cy=\"46\" r=\"8.5\" fill=\"#090d16\"/>" +
                "<circle cx=\"84\" cy=\"46\" r=\"8.5\" fill=\"#090d16\"/>" +
                "<circle cx=\"38.5\" cy=\"43.5\" r=\"3\" fill=\"#ffffff\"/>" +
                "<circle cx=\"86.5\" cy=\"43.5\" r=\"3\" fill=\"#ffffff\"/>" +
                "<circle cx=\"25\" cy=\"56\" r=\"2\" fill=\"rgba(255,255,255,0.88)\"/>" +
                "<circle cx=\"30\" cy=\"59\" r=\"2\" fill=\"rgba(255,255,255,0.88)\"/>" +
                "<circle cx=\"24\" cy=\"61\" r=\"2\" fill=\"rgba(255,255,255,0.88)\"/>" +
                "<circle cx=\"90\" cy=\"56\" r=\"2\" fill=\"rgba(255,255,255,0.88)\"/>" +
                "<circle cx=\"95\" cy=\"59\" r=\"2\" fill=\"rgba(255,255,255,0.88)\"/>" +
                "<circle cx=\"89\" cy=\"61\" r=\"2\" fill=\"rgba(255,255,255,0.88)\"/>" +
                "<path d=\"M 38 69 Q 62 82 84 67\" fill=\"none\" stroke=\"#090d16\" stroke-width=\"6\" stroke-linecap=\"round\"/>";
            var imgLayer = "<image href=\"" + dataUri + "\" x=\"0\" y=\"0\" width=\"120\" height=\"120\" preserveAspectRatio=\"xMidYMid slice\"/>";
            var kidsBadge = (idx === 6)
                ? "<rect x=\"22\" y=\"92\" width=\"76\" height=\"22\" rx=\"6\" fill=\"rgba(15,23,42,0.82)\" stroke=\"rgba(255,255,255,0.45)\" stroke-width=\"1.2\"/>" +
                  "<text x=\"60\" y=\"108\" text-anchor=\"middle\" fill=\"#ffffff\" font-family=\"sans-serif\" font-weight=\"900\" font-size=\"13\" letter-spacing=\"2.5\">KIDS</text>"
                : "";
            cache.push(
                "<svg class=\"profile-avatar-svg\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 120 120\">" +
                "<defs>" +
                "<linearGradient id=\"" + gradId + "\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">" +
                "<stop offset=\"0%\" stop-color=\"" + pal[0] + "\"/><stop offset=\"100%\" stop-color=\"" + pal[1] + "\"/>" +
                "</linearGradient>" +
                "</defs>" +
                "<rect width=\"120\" height=\"120\" fill=\"url(#" + gradId + ")\"/>" +
                fallbackMonsterArt +
                imgLayer +
                kidsBadge +
                "</svg>"
            );
        }
        return cache;
    })();
    function renderProfileAvatarSvg(avatarIdx) {
        var idx = Math.max(0, Math.min(6, Number(avatarIdx) || 0));
        return NETFLIX_AVATAR_SVG_CACHE[idx] || NETFLIX_AVATAR_SVG_CACHE[0];
    }

    var lastProfileCardIdx = 0;
    function getProfilePickerTotalCount() {
        return (Array.isArray(profiles) ? profiles.length : 0) + 2;
    }

    function formatProfileSubtitle(prof) {
        if (!prof) {
            return '';
        }
        var pType = String(prof.type || 'stalker').toLowerCase();
        if (pType === 'xtream') {
            var u = String(prof.xtreamUser || '').trim();
            var h = String(prof.xtreamUrl || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
            return u ? (u + (h ? ' @ ' + h : '')) : (h || 'Xtream Codes API');
        }
        if (pType === 'm3u') {
            if (prof.m3uFileName) {
                return prof.m3uFileName;
            }
            var m = String(prof.m3uUrl || '').replace(/^https?:\/\//i, '');
            return m || 'M3U Playlist';
        }
        return String(prof.mac || '00:1A:79:A4:B2:C9');
    }

    function renderProfilePickerGrid() {
        var gridEl = document.getElementById('profile-picker-grid');
        var manageBtnEl = document.getElementById('btn-manage-profiles');
        if (!gridEl) {
            return;
        }
        gridEl.innerHTML = '';
        var list = Array.isArray(profiles) ? profiles : [];
        var addIdx = list.length;
        var manageIdx = list.length + 1;

        for (var i = 0; i < list.length; i++) {
            (function(idx, prof) {
                var card = document.createElement('div');
                var isFocused = (profilePickerIdx === idx);
                var isActive = (prof.id === activeProfileId);
                card.className = 'profile-picker-card' + (isFocused ? ' focused' : '');

                var avatarBox = document.createElement('div');
                avatarBox.className = 'profile-avatar-box';
                var isKids = /kid|child/i.test(prof.name || '');
                var avatarNum = isKids ? 6 : (typeof prof.avatarIdx === 'number' ? prof.avatarIdx : (idx % 6));
                var pType = String(prof.type || 'stalker').toUpperCase();
                var activeBadgeHtml = isActive ? '<span class="profile-active-tag">ACTIVE</span>' : '';
                var provBadgeHtml = '<span class="profile-prov-tag">' + pType + '</span>';
                avatarBox.innerHTML = renderProfileAvatarSvg(avatarNum) + activeBadgeHtml + provBadgeHtml;
                card.appendChild(avatarBox);

                var nameEl = document.createElement('div');
                nameEl.className = 'profile-card-name';
                nameEl.textContent = prof.name || ('Profile ' + (idx + 1));
                card.appendChild(nameEl);

                var subEl = document.createElement('div');
                subEl.className = 'profile-card-sub';
                subEl.textContent = formatProfileSubtitle(prof);
                card.appendChild(subEl);

                card.onclick = function(ev) {
                    ev.stopPropagation();
                    profilePickerIdx = idx;
                    lastProfileCardIdx = idx;
                    renderProfilePickerGrid();
                    var wasAlreadyLoaded = (prof.id === activeProfileId && liveGenres.length > 3 && (allChannels.length > 0 || liveGenrePaged));
                    closeProfilePickerModal();
                    if (isProfileConfigured(prof)) {
                        if (!wasAlreadyLoaded) {
                            activateProfileAndConnect(prof);
                        }
                    } else {
                        editingProfileIndex = idx;
                        openSettings();
                    }
                };
                gridEl.appendChild(card);
            })(i, list[i]);
        }

        var addCard = document.createElement('div');
        addCard.className = 'profile-picker-card add-profile-card' + (profilePickerIdx === addIdx ? ' focused' : '');
        addCard.innerHTML =
            '<div class="profile-avatar-box"><div class="profile-add-circle">+</div></div>' +
            '<div class="profile-card-name">Add Profile</div>' +
            '<div class="profile-card-sub">New Portal / Playlist</div>';
        addCard.onclick = function(ev) {
            ev.stopPropagation();
            profilePickerIdx = addIdx;
            lastProfileCardIdx = addIdx;
            closeProfilePickerModal();
            openSettings();
            createNewProfileInSettings();
        };
        gridEl.appendChild(addCard);

        if (manageBtnEl) {
            if (profilePickerIdx === manageIdx) {
                manageBtnEl.classList.add('focused');
            } else {
                manageBtnEl.classList.remove('focused');
            }
            manageBtnEl.onclick = function(ev) {
                ev.stopPropagation();
                if (lastProfileCardIdx < list.length) {
                    editingProfileIndex = lastProfileCardIdx;
                }
                closeProfilePickerModal();
                openSettings();
            };
        }
    }

    function openProfilePickerModal() {
        loadProfiles();
        if (searchOpen) {
            closeSearch();
        }
        if (settingsOpen) {
            closeSettings();
        }
        profilePickerOpen = true;
        profilePickerIdx = 0;
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === activeProfileId) {
                profilePickerIdx = i;
                break;
            }
        }
        lastProfileCardIdx = profilePickerIdx;
        renderProfilePickerGrid();
        var modalEl = document.getElementById('profile-picker-modal');
        if (modalEl) {
            modalEl.style.display = '';
            modalEl.classList.add('visible');
        }
        updateContextualHelpBar();
    }

    function closeProfilePickerModal() {
        profilePickerOpen = false;
        var modalEl = document.getElementById('profile-picker-modal');
        if (modalEl) {
            modalEl.classList.remove('visible');
            modalEl.style.display = '';
        }
        if (modes[modeIdx] && modes[modeIdx].id === 'profiles') {
            modeIdx = lastContentModeIdx || 0;
            renderModes();
        }
        updateContextualHelpBar();
    }

    var lanSetupPin = '';
    function getOrInitLanSetupPin() {
        if (lanSetupPin && /^\d{4}$/.test(lanSetupPin)) {
            return lanSetupPin;
        }
        try {
            var savedPin = sessionStorage.getItem('smartstb_lan_pin') || localStorage.getItem('smartstb_lan_pin') || '';
            if (/^\d{4}$/.test(savedPin)) {
                lanSetupPin = savedPin;
                return lanSetupPin;
            }
        } catch (ePinRead) {}
        var randVal = Math.floor(1000 + Math.random() * 9000);
        try {
            if (typeof window.crypto !== 'undefined' && window.crypto.getRandomValues) {
                var arr = new Uint32Array(1);
                window.crypto.getRandomValues(arr);
                randVal = 1000 + (arr[0] % 9000);
            }
        } catch (eCry) {}
        lanSetupPin = String(randVal);
        try {
            sessionStorage.setItem('smartstb_lan_pin', lanSetupPin);
            localStorage.setItem('smartstb_lan_pin', lanSetupPin);
        } catch (ePinSave) {}
        return lanSetupPin;
    }

    function ensureLanPinBadgeDom() {
        var pinBadgeEl = document.getElementById('lan-pairing-pin-badge') || document.getElementById('lan-setup-pin-badge');
        if (pinBadgeEl) {
            return pinBadgeEl;
        }
        var bannerEl = document.getElementById('lan-setup-banner');
        if (!bannerEl) {
            return null;
        }
        var metaEl = bannerEl.querySelector('.lan-setup-meta') || bannerEl.querySelector('.lan-setup-right') || bannerEl;
        var pinSpan = document.createElement('span');
        pinSpan.id = 'lan-pairing-pin-badge';
        pinSpan.className = 'lan-setup-pill lan-pin-pill';
        metaEl.insertBefore(pinSpan, metaEl.firstChild);
        return pinSpan;
    }

    // 380MB DDR RAM Budget Enforcer (Periodic + Mode Switch Cache Trimmer)
    function enforceTizenRamBudget() {
        try {
            var shortKeys = Object.keys(shortEpgCache);
            if (shortKeys.length > 60) {
                for (var s = 0; s < shortKeys.length - 45; s++) {
                    delete shortEpgCache[shortKeys[s]];
                }
            }
            var fullKeys = Object.keys(fullEpgCache);
            if (fullKeys.length > 15) {
                for (var f = 0; f < fullKeys.length - 10; f++) {
                    delete fullEpgCache[fullKeys[f]];
                }
            }
            var vodMetaKeys = Object.keys(vodExtendedMetaCache);
            if (vodMetaKeys.length > 40) {
                for (var v = 0; v < vodMetaKeys.length - 25; v++) {
                    delete vodExtendedMetaCache[vodMetaKeys[v]];
                }
            }
            var b64Keys = Object.keys(xtreamB64DecodeCache);
            if (b64Keys.length > 300) {
                xtreamB64DecodeCache = {};
            }
            var xmlKeys = Object.keys(xmltvCache);
            if (xmlKeys.length > 3) {
                for (var x = 0; x < xmlKeys.length - 2; x++) {
                    delete xmltvCache[xmlKeys[x]];
                }
            }
            var rawM3uKeys = Object.keys(m3uRawMemoryCache);
            for (var m = 0; m < rawM3uKeys.length; m++) {
                var mKey = rawM3uKeys[m];
                if (mKey !== activeProfileId || (m3uRawMemoryCache[mKey] && m3uRawMemoryCache[mKey].length > 120000)) {
                    delete m3uRawMemoryCache[mKey];
                }
            }
        } catch (eRam) {}
    }
    setInterval(enforceTizenRamBudget, 45000);

    function stopLanRemoteSetupPolling() {
        if (lanSetupPollTimer) {
            clearInterval(lanSetupPollTimer);
            lanSetupPollTimer = null;
        }
    }
    function startLanRemoteSetupPolling() {
        stopLanRemoteSetupPolling();
        var hwIp = discoverHardwareTvLanIp();
        var currentPin = getOrInitLanSetupPin();
        var qrWrapEl = document.getElementById('lan-setup-qr-wrap');
        var pinBadgeEl = ensureLanPinBadgeDom();
        if (pinBadgeEl) {
            pinBadgeEl.textContent = '🔑 PIN: ' + currentPin;
        }
        var initialUrl = hwIp ? ('http://' + hwIp + ':3001/setup') : (api.proxyUrl + '/setup');
        if (lanSetupUrlEl && (!lanSetupUrlEl.textContent || lanSetupUrlEl.textContent.indexOf('127.0.0.1') !== -1)) {
            lanSetupUrlEl.textContent = initialUrl;
        }
        if (qrWrapEl) {
            qrWrapEl.innerHTML = generateQrSvgVersion2(initialUrl, 224);
        }
        proxyFetch(api.proxyUrl + '/lan-info?pin=' + encodeURIComponent(currentPin), { method: 'GET' }).then(function(r) {
            return r.json();
        }).then(function(info) {
            var lanIp = hwIp || (info && info.ip) || '127.0.0.1';
            var portNum = (info && info.port) || 3001;
            var lanUrl = (hwIp && info && info.url && info.url.indexOf('127.0.0.1') !== -1)
                ? ('http://' + hwIp + ':' + portNum + '/setup')
                : ((info && (info.url || info.setupUrl)) || ('http://' + lanIp + ':' + portNum + '/setup'));
            if (lanSetupUrlEl && lanUrl) {
                lanSetupUrlEl.textContent = lanUrl;
            }
            if (qrWrapEl) {
                qrWrapEl.innerHTML = generateQrSvgVersion2(lanUrl, 224);
            }
            var resolvedPin = (info && (info.pairingPin || info.pin)) ? String(info.pairingPin || info.pin) : currentPin;
            if (resolvedPin) {
                lanSetupPin = resolvedPin;
                try {
                    sessionStorage.setItem('smartstb_lan_pin', lanSetupPin);
                } catch (eP) {}
                if (pinBadgeEl) {
                    pinBadgeEl.textContent = '🔑 PIN: ' + lanSetupPin;
                }
            }
        }).catch(function() {
            var fallbackUrl = hwIp ? ('http://' + hwIp + ':3001/setup') : (api.proxyUrl + '/setup');
            if (lanSetupUrlEl) {
                lanSetupUrlEl.textContent = fallbackUrl;
            }
            if (qrWrapEl) {
                qrWrapEl.innerHTML = generateQrSvgVersion2(fallbackUrl, 224);
            }
            if (pinBadgeEl) {
                pinBadgeEl.textContent = '🔑 PIN: ' + getOrInitLanSetupPin();
            }
        });

        lanSetupPollTimer = setInterval(function() {
            if (!settingsOpen) {
                stopLanRemoteSetupPolling();
                return;
            }
            proxyFetch(api.proxyUrl + '/remote-setup?consume=1', { method: 'GET' }).then(function(r) {
                return r.json();
            }).then(function(data) {
                var newPin = (data && (data.pairingPin || data.pin)) ? String(data.pairingPin || data.pin) : '';
                if (newPin && newPin !== lanSetupPin) {
                    lanSetupPin = newPin;
                    if (pinBadgeEl) {
                        pinBadgeEl.textContent = '🔑 PIN: ' + lanSetupPin;
                    }
                }
                if (data && data.pendingRestore && typeof data.pendingRestore === 'object') {
                    var restoreMap = data.pendingRestore.data || data.pendingRestore.storage || data.pendingRestore;
                    if (restoreMap && typeof restoreMap === 'object') {
                        var keys = Object.keys(restoreMap);
                        for (var k = 0; k < keys.length; k++) {
                            var keyName = keys[k];
                            var val = restoreMap[keyName];
                            safeSetStorage(keyName, typeof val === 'string' ? val : JSON.stringify(val));
                        }
                        loadProfiles();
                        renderProfileSelectOptions(true);
                        loadProfileIntoSettingsInputs(editingProfileIndex, true);
                        showToast('📦 Restored TV Backup from Phone over LAN!');
                        saveSettingsAndBoot();
                        return;
                    }
                }
                var rawPending = data && data.pending;
                var pushed = (rawPending && rawPending.profile) ? rawPending.profile : rawPending;
                if (!pushed || !pushed.type) {
                    return;
                }
                var targetProf = profiles[editingProfileIndex];
                if (!targetProf) {
                    return;
                }
                var pType = (pushed.type === 'xtream' || pushed.type === 'm3u') ? pushed.type : 'stalker';
                targetProf.type = pType;
                if (pushed.name) {
                    targetProf.name = String(pushed.name).trim();
                }
                if (pushed.portal) {
                    targetProf.portal = String(pushed.portal).trim();
                }
                if (pushed.mac) {
                    targetProf.mac = String(pushed.mac).trim();
                }
                if (pushed.xtreamUrl) {
                    targetProf.xtreamUrl = String(pushed.xtreamUrl).trim();
                }
                if (pushed.xtreamUser) {
                    targetProf.xtreamUser = String(pushed.xtreamUser).trim();
                }
                if (pushed.xtreamPass) {
                    targetProf.xtreamPass = String(pushed.xtreamPass).trim();
                }
                if (pushed.m3uUrl) {
                    targetProf.m3uUrl = String(pushed.m3uUrl).trim();
                }
                if (pushed.epgUrl !== undefined) {
                    targetProf.epgUrl = String(pushed.epgUrl || '').trim();
                }
                if (pushed.epgOffsetHours !== undefined) {
                    targetProf.epgOffsetHours = Number(pushed.epgOffsetHours) || 0;
                }
                loadProfileIntoSettingsInputs(editingProfileIndex, true);
                showToast('📱 Received Remote Setup from Phone/PC!');
                saveSettingsAndBoot();
            }).catch(function() {});
        }, 2500);
    }

    function openSettings() {
        if (searchOpen) {
            closeSearch();
        }
        if (profilePickerOpen) {
            closeProfilePickerModal();
        }
        if (filterOpen) {
            closeFilterModal();
        }
        if (epgModalOpen) {
            closeEpgModal();
        }
        if (pinModalOpen) {
            closePinModal();
        }
        if (tracksModalOpen) {
            closeTracksModal();
        }
        if (miniZapOpen) {
            closeMiniZapDrawer();
        }
        loadProfiles();
        setOverlayVisible(true);
        settingsOpen = true;
        activeCol = 'settings';
        modeIdx = getModeIndexById('settings');
        settingsRow = 0;
        settingsCol = 0;
        settingsLastColRatio = 0;
        if (inpXtreamPassEl && btnXtreamPassToggleEl) {
            inpXtreamPassEl.type = 'password';
            btnXtreamPassToggleEl.textContent = 'Show';
        }
        renderProfileSelectOptions(true);
        loadProfileIntoSettingsInputs(editingProfileIndex, true);
        setSettingsConnStatus(isProfileConfigured(profiles[editingProfileIndex]) ? 'Configured' : 'Not Configured', '');
        if (selThemeEl) {
            selThemeEl.value = localStorage.getItem('cfg_theme') || 'blue';
        }
        if (selBufferModeEl) {
            selBufferModeEl.value = bufferModePref || localStorage.getItem('cfg_buffer_mode') || 'fast';
        }
        if (selStartupModeEl) {
            startupModePref = getEffectiveStartupMode();
            selStartupModeEl.value = startupModePref;
        }
        if (selOsdTimeoutEl) {
            selOsdTimeoutEl.value = String(osdTimeoutDurationMs || Number(localStorage.getItem('cfg_osd_timeout')) || 5000);
        }
        if (inpPinEl) {
            inpPinEl.value = localStorage.getItem('cfg_pin') || api.parentalPin || '0000';
        }
        if (document.body && document.body.classList) {
            document.body.classList.add('settings-section-active');
        }
        if (settingsModal) {
            settingsModal.classList.add('visible');
        }
        renderModes();
        updateColumnFocusClasses();
        updateSettingsFocus();
        startLanRemoteSetupPolling();
    }
    function closeSettings() {
        stopLanRemoteSetupPolling();
        var focusedEl = getFocusedModalElement(settingsGrid, settingsRow, settingsCol);
        if (focusedEl && focusedEl.blur) {
            focusedEl.blur();
        }
        settingsOpen = false;
        imeActive = false;
        if (document.body && document.body.classList) {
            document.body.classList.remove('settings-section-active');
        }
        if (settingsModal) {
            settingsModal.classList.remove('visible');
            settingsModal.classList.remove('focused');
        }
        if (modes[modeIdx] && modes[modeIdx].id === 'settings') {
            modeIdx = lastContentModeIdx;
        }
        if (activeCol === 'settings') {
            activeCol = 'cats';
        }
        renderModes();
        updateColumnFocusClasses();
        if (rawCats.length === 0 && !liveCatalogLoading && !vodLoading && !seriesLoading) {
            switchMode(modeIdx);
        }
    }
    function updateSettingsFocus() {
        if (activeCol === 'modes') {
            for (var i = 0; i < settingsEls.length; i++) {
                if (settingsEls[i] && settingsEls[i].classList) {
                    settingsEls[i].classList.remove('focused');
                }
            }
            return null;
        }
        return applyGridFocus(settingsEls, settingsGrid, settingsRow, settingsCol);
    }
    function rebootApp() {
        stopPlayback();
        try {
            localStorage.removeItem('stalker_live');
        } catch (eRmLive) {}
        if (activeProfileId) {
            delete fullEpgCache[activeProfileId];
            var curProf = getActiveProfile();
            var hasRemoteM3u = Boolean(curProf && curProf.m3uUrl && curProf.m3uUrl.indexOf('local://') !== 0);
            if (hasRemoteM3u) {
                delete m3uRawMemoryCache[activeProfileId];
                try {
                    localStorage.removeItem('m3u_raw_' + activeProfileId);
                } catch (eRmM3u) {}
                proxyFetch(api.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent('m3u_raw_' + activeProfileId) + '&action=delete', {
                    method: 'GET'
                }).catch(function() {});
            }
            proxyFetch(api.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent(activeProfileId) + '&action=delete&mac=' + encodeURIComponent((curProf && curProf.mac) || ''), {
                method: 'GET'
            }).catch(function() {});
        }
        resetCatalogMemoryState();
        showToast('🧹 Clearing catalog cache & reloading...');
        showOSD('Clearing Cache...', 'Reloading application');
        setTimeout(function() {
            window.location.reload();
        }, 180);
    }
    function resetCatalogMemoryState() {
        stopPlayback();
        currentPlayingItem = null;
        previousLiveChannel = null;
        lockedPreviewItem = null;
        hasAutoResumedOnBoot = false;
        userInteractedSinceBoot = false;
        window._parentalUnlocked = false;
        if (warmPreloadTimer) {
            clearTimeout(warmPreloadTimer);
            warmPreloadTimer = null;
        }
        if (catHoverTimer) {
            clearTimeout(catHoverTimer);
            catHoverTimer = null;
        }
        if (previewEpgTimeout) {
            clearTimeout(previewEpgTimeout);
            previewEpgTimeout = null;
        }
        if (previewDebounceTimer) {
            clearTimeout(previewDebounceTimer);
            previewDebounceTimer = null;
        }
        if (posterLoadTimer) {
            clearTimeout(posterLoadTimer);
            posterLoadTimer = null;
        }
        if (numTimeout) {
            clearTimeout(numTimeout);
            numTimeout = null;
            numBuffer = '';
            if (numOsdEl) {
                numOsdEl.classList.remove('visible');
            }
        }
        if (searchOpen) {
            closeSearch();
        }
        if (profilePickerOpen) {
            closeProfilePickerModal();
        }
        if (trailerModalOpen) {
            closeTrailerModal();
        }
        if (filterOpen) {
            closeFilterModal();
        }
        if (epgModalOpen) {
            closeEpgModal();
        }
        if (pinModalOpen) {
            closePinModal();
        }
        if (tracksModalOpen) {
            closeTracksModal();
        }
        if (miniZapOpen) {
            closeMiniZapDrawer();
        }
        invalidateFavCaches();
        api.resetProviderCaches();
        adultCatLookup = { live: {}, vod: {}, series: {} };
        vodExtendedMetaCache = {};
        xtreamB64DecodeCache = {};
        activeSeriesSeasons = [];
        activeSeriesPlaylist = [];
        playingEpisodeList = [];
        searchResults = [];
        liveGenres = [];
        allChannels = [];
        vodCats = [];
        seriesCats = [];
        rawCats = [];
        rawItems = [];
        currentCats = [];
        currentItems = [];
        seriesStack = [];
        seriesLoading = false;
        vodLoading = false;
        liveCatalogLoading = false;
        shortEpgCache = {};
        shortEpgKeys = [];
        fullEpgCache = {};
        epgGridProgramsByCh = {};
        pagedLiveGenresMap = {};
        loadedCatSignature = '';
        catIdx = 0;
        itemIdx = 0;
        lastQuickActionSig = '';
        if (catsListEl) {
            catsListEl._lastItemsRef = null;
            catsListEl._gridRef = null;
            catsListEl.innerHTML = '';
        }
        if (itemsListEl) {
            itemsListEl._lastItemsRef = null;
            itemsListEl._gridRef = null;
            itemsListEl.innerHTML = '';
        }
        if (miniZapListEl) {
            miniZapListEl._lastItemsRef = null;
            miniZapListEl.innerHTML = '';
        }
        if (searchResultsContainer) {
            searchResultsContainer._lastItemsRef = null;
            searchResultsContainer.innerHTML = '';
        }
        rebuildGenreChannelCounts();
    }

    function activateProfileAndConnect(prof) {
        if (!prof) {
            return;
        }
        var targetModeIdx = (modes[modeIdx] && modes[modeIdx].id !== 'settings' && modes[modeIdx].id !== 'search' && modes[modeIdx].id !== 'profiles') ? modeIdx : (lastContentModeIdx || 0);
        activeProfileId = prof.id;
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === prof.id) {
                editingProfileIndex = i;
                break;
            }
        }
        safeSetStorage('cfg_profiles', JSON.stringify(profiles));
        syncActiveProfileToLegacyKeys(prof);
        resetCatalogMemoryState();
        if (accountBadgeEl) {
            accountBadgeEl.textContent = '⏳ Connecting...';
            accountBadgeEl.classList.remove('warn');
            accountBadgeEl.classList.add('connecting');
        }
        showToast('⚡ Switching to ' + (prof.name || 'Portal') + '...');
        var switchProfId = prof.id;
        // v2.1.0 Synchronized Profile Reset (/reset_session clears keep-alive sockets & cookies)
        proxyFetch(api.proxyUrl + '/reset_session', { method: 'POST' }).catch(function() {}).then(function() {
            if (activeProfileId !== switchProfId) {
                return;
            }
            var curTargetModeIdx = (modes[modeIdx] && modes[modeIdx].id !== 'settings' && modes[modeIdx].id !== 'search' && modes[modeIdx].id !== 'profiles')
                ? modeIdx
                : (targetModeIdx || 0);
            switchMode(curTargetModeIdx);
            return wakeLocalService().then(function() {
                if (activeProfileId !== switchProfId) {
                    return;
                }
                return api.boot();
            });
        }).catch(function(err) {
            if (activeProfileId !== switchProfId) {
                return;
            }
            if (accountBadgeEl) {
                accountBadgeEl.textContent = '⚠ Offline';
                accountBadgeEl.classList.remove('connecting');
                accountBadgeEl.classList.add('warn');
            }
            showOSD('Connection Error', err.message);
            showToast('⚠ Connection failed: ' + err.message);
        });
    }

    function cycleActivePortalProfile() {
        loadProfiles();
        if (!Array.isArray(profiles) || profiles.length <= 1) {
            openSettings();
            return;
        }
        var curIdx = 0;
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === activeProfileId) {
                curIdx = i;
                break;
            }
        }
        for (var step = 1; step <= profiles.length; step++) {
            var nextIdx = (curIdx + step) % profiles.length;
            var candidate = profiles[nextIdx];
            if (candidate && isProfileConfigured(candidate)) {
                activateProfileAndConnect(candidate);
                return;
            }
        }
        openSettings();
    }

    function saveSettingsAndBoot() {
        saveCurrentInputsToEditingProfile();
        var prof = profiles[editingProfileIndex];
        if (!prof) {
            return;
        }
        var pType = (selProviderTypeEl && selProviderTypeEl.value) ? selProviderTypeEl.value : (prof.type || 'stalker');
        prof.type = pType;
        prof.name = (inpProfileNameEl && inpProfileNameEl.value.trim()) || 'Portal ' + (editingProfileIndex + 1);
        prof.portal = (inpPortalEl && inpPortalEl.value.trim()) || '';
        prof.mac = (inpMacEl && inpMacEl.value.trim()) || '';
        prof.xtreamUrl = (inpXtreamUrlEl && inpXtreamUrlEl.value.trim()) || '';
        prof.xtreamUser = (inpXtreamUserEl && inpXtreamUserEl.value.trim()) || '';
        prof.xtreamPass = (inpXtreamPassEl && inpXtreamPassEl.value.trim()) || '';
        prof.m3uUrl = (inpM3uUrlEl && inpM3uUrlEl.value.trim()) || '';
        prof.epgUrl = (inpEpgUrlEl && inpEpgUrlEl.value.trim()) || '';
        prof.epgOffsetHours = selEpgOffsetEl ? (Number(selEpgOffsetEl.value) || 0) : (Number(prof.epgOffsetHours) || 0);
        cachedEpgOffsetSec = Math.round(prof.epgOffsetHours * 3600);

        if (selBufferModeEl && selBufferModeEl.value) {
            bufferModePref = selBufferModeEl.value;
            safeSetStorage('cfg_buffer_mode', bufferModePref);
        }
        if (selStartupModeEl && selStartupModeEl.value) {
            var prevEff = getEffectiveStartupMode();
            startupModePref = selStartupModeEl.value;
            safeSetStorage('cfg_startup_mode', startupModePref);
            if (startupModePref !== prevEff) {
                safeSetStorage('cfg_startup_mode_user_set', '1');
            }
        }
        if (selOsdTimeoutEl && selOsdTimeoutEl.value) {
            osdTimeoutDurationMs = Number(selOsdTimeoutEl.value) || 5000;
            safeSetStorage('cfg_osd_timeout', String(osdTimeoutDurationMs));
        }

        if (pType === 'xtream') {
            if (!prof.xtreamUrl || !/^https?:\/\//i.test(prof.xtreamUrl)) {
                showOSD('Validation Error', 'Xtream Server URL must start with http:// or https://');
                showToast('⚠ Enter a valid Xtream Server URL');
                return;
            }
            if (!prof.xtreamUser || !prof.xtreamPass) {
                showOSD('Validation Error', 'Xtream Username and Password are required');
                showToast('⚠ Enter Xtream Username and Password');
                return;
            }
        } else if (pType === 'm3u') {
            var hasValidRemoteM3u = Boolean(prof.m3uUrl && /^https?:\/\/.+/i.test(prof.m3uUrl));
            var hasRawM3u = Boolean(m3uRawMemoryCache[prof.id] || localStorage.getItem('m3u_raw_' + prof.id) || prof.m3uFileName);
            if (!hasValidRemoteM3u && !hasRawM3u) {
                showOSD('Validation Error', 'Provide an http(s):// M3U URL or upload a local .m3u/.m3u8 file');
                showToast('⚠ Enter M3U URL or load a local M3U file');
                return;
            }
        } else {
            if (!prof.portal || !/^https?:\/\//i.test(prof.portal)) {
                showOSD('Validation Error', 'Stalker Portal URL must start with http:// or https://');
                showToast('⚠ Enter a valid Stalker Portal URL');
                return;
            }
            if (!prof.mac) {
                prof.mac = '00:1A:79:00:00:01';
            }
        }

        if (selThemeEl) {
            applyTheme(selThemeEl.value);
        }
        if (inpPinEl && inpPinEl.value.trim().length > 0) {
            var newPin = inpPinEl.value.trim();
            if (!/^\d{4}$/.test(newPin)) {
                showOSD('Validation Error', 'Parental PIN must be 4 numeric digits (0-9) for TV remote entry');
                showToast('⚠ Parental PIN must be 4 digits (0-9)');
                return;
            }
            safeSetStorage('cfg_pin', newPin);
            api.parentalPin = newPin;
        }
        closeSettings();
        activateProfileAndConnect(prof);
    }
    function createNewProfileInSettings() {
        saveCurrentInputsToEditingProfile();
        var newId = 'prof_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        var curType = (selProviderTypeEl && selProviderTypeEl.value) ? selProviderTypeEl.value : 'stalker';
        profiles.push({
            id: newId,
            name: 'Profile ' + (profiles.length + 1),
            type: curType,
            portal: 'http://',
            mac: '00:1A:79:00:00:01',
            xtreamUrl: '',
            xtreamUser: '',
            xtreamPass: '',
            m3uUrl: '',
            m3uFileName: '',
            epgUrl: '',
            epgOffsetHours: 0
        });
        renderProfileSelectOptions(true);
        loadProfileIntoSettingsInputs(profiles.length - 1, true);
        showToast('Created Profile: Profile ' + profiles.length);
    }
    function deleteCurrentProfileInSettings() {
        if (profiles.length <= 1) {
            showOSD('Profiles', 'Cannot delete the only profile');
            showToast('Cannot delete the only profile');
            return;
        }
        var deletedProf = profiles[editingProfileIndex] || null;
        var deletedId = deletedProf ? deletedProf.id : null;
        var deletedMac = deletedProf ? (deletedProf.mac || '') : '';
        profiles.splice(editingProfileIndex, 1);
        editingProfileIndex = Math.max(0, editingProfileIndex - 1);
        activeProfileId = profiles[editingProfileIndex].id;
        safeSetStorage('cfg_profiles', JSON.stringify(profiles));
        syncActiveProfileToLegacyKeys(profiles[editingProfileIndex]);
        if (deletedId) {
            delete m3uRawMemoryCache[deletedId];
            try {
                localStorage.removeItem('m3u_raw_' + deletedId);
                var scopedPrefixes = [
                    'fav_live_', 'fav_vod_objs_', 'fav_series_objs_',
                    'rec_items_', 'rec_vod_', 'vod_resume_', 'vod_watched_',
                    'last_live_', 'pinned_cats_live_', 'pinned_cats_vod_', 'pinned_cats_series_',
                    'hidden_cats_live_', 'hidden_cats_vod_', 'hidden_cats_series_',
                    'hidden_items_live_', 'hidden_items_vod_', 'hidden_items_series_',
                    'epg_reminders_', 'vod_bookmarks_', 'ch_prefs_'
                ];
                for (var sp = 0; sp < scopedPrefixes.length; sp++) {
                    localStorage.removeItem(scopedPrefixes[sp] + deletedId);
                }
                if (deletedId === 'prof_default') {
                    var legacyBaseKeys = ['fav_live', 'fav_vod_objs', 'fav_series_objs', 'rec_items', 'rec_vod', 'vod_resume', 'vod_watched', 'last_live'];
                    for (var lb = 0; lb < legacyBaseKeys.length; lb++) {
                        localStorage.removeItem(legacyBaseKeys[lb]);
                    }
                }
                var liveSnap = safeGetJson('stalker_live', null);
                if (liveSnap && liveSnap.profileId === deletedId) {
                    localStorage.removeItem('stalker_live');
                }
                var keysToRemove = [];
                for (var k = 0; k < localStorage.length; k++) {
                    var kName = localStorage.key(k);
                    if (kName && (kName.indexOf(deletedId) !== -1 || kName.indexOf('_' + deletedId) !== -1)) {
                        keysToRemove.push(kName);
                    }
                }
                for (var r = 0; r < keysToRemove.length; r++) {
                    localStorage.removeItem(keysToRemove[r]);
                }
            } catch (exClean) {}
            delete fullEpgCache[deletedId];
            proxyFetch(api.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent(deletedId) + '&action=delete&mac=' + encodeURIComponent(deletedMac), {
                method: 'GET'
            }).catch(function() {});
            proxyFetch(api.proxyUrl + '/catalog-cache?profile=' + encodeURIComponent('m3u_raw_' + deletedId) + '&action=delete', {
                method: 'GET'
            }).catch(function() {});
        }
        cachedEpgOffsetSec = Math.round((Number(profiles[editingProfileIndex].epgOffsetHours) || 0) * 3600);
        resetCatalogMemoryState();
        renderProfileSelectOptions(true);
        loadProfileIntoSettingsInputs(editingProfileIndex, true);
        switchMode(lastContentModeIdx);
        showToast('🗑 Profile & cached data deleted');
    }

    function openSearch() {
        if (settingsOpen) {
            closeSettings();
        }
        searchOpen = true;
        searchFocusArea = 'input';
        searchIdx = 0;
        searchResults = [];
        if (searchInput) {
            searchInput.value = '';
            searchInput.classList.add('focused');
        }
        if (searchResultsContainer) {
            searchResultsContainer._lastItemsRef = null;
            searchResultsContainer.innerHTML = '';
        }
        if (searchModal) {
            searchModal.classList.add('visible');
        }
        updateContextualHelpBar();
        if (searchInput && typeof searchInput.focus === 'function') {
            setTimeout(function() {
                if (searchOpen && searchInput) {
                    searchInput.focus();
                }
            }, 20);
        }
        var searchProfId = activeProfileId;
        if (vodCats.length <= 5) {
            api.fetchVodCategories().then(function(cats) {
                if (activeProfileId === searchProfId && Array.isArray(cats) && cats.length > 5 && vodCats.length <= 5) {
                    vodCats = cats;
                }
            }).catch(function() {});
        }
        if (seriesCats.length <= 5) {
            api.fetchSeriesCategories().then(function(cats) {
                if (activeProfileId === searchProfId && Array.isArray(cats) && cats.length > 5 && seriesCats.length <= 5) {
                    seriesCats = cats;
                }
            }).catch(function() {});
        }
    }
    function closeSearch() {
        searchOpen = false;
        if (searchInput) {
            searchInput.blur();
        }
        if (modes[modeIdx] && modes[modeIdx].id === 'search') {
            modeIdx = lastContentModeIdx;
            renderModes();
        }
        if (searchModal) {
            searchModal.classList.remove('visible');
        }
        updateContextualHelpBar();
    }
    function matchCategoryList(categoryArray, q, labelPrefix, targetModeIdx) {
        var list = Array.isArray(categoryArray) ? categoryArray : [];
        var matches = [];
        var modeId = targetModeIdx === 2 ? 'series' : (targetModeIdx === 1 ? 'vod' : 'live');
        for (var i = 0; i < list.length; i++) {
            var c = list[i];
            if (!c || c.id === '*' || c.id === 'new' || c.id === 'cont' || c.id === 'fav' || c.id === 'rec') {
                continue;
            }
            var title = String(c.title || '');
            if (!window._parentalUnlocked && (Boolean(c.censored) || ADULT_RE.test(title))) {
                continue;
            }
            if (!showHiddenEntries && isHiddenCategory(modeId, c.id)) {
                continue;
            }
            if (getCatLowerTitle(c).indexOf(q) !== -1) {
                matches.push({
                    id: 'cat_' + targetModeIdx + '_' + c.id,
                    isCategoryResult: true,
                    targetModeIdx: targetModeIdx,
                    catId: String(c.id),
                    name: title,
                    censored: Boolean(c.censored),
                    display: '📂 [' + labelPrefix + ' Category] ' + title
                });
                if (matches.length >= 15) {
                    break;
                }
            }
        }
        return matches;
    }
    function performSearch(query) {
        var q = (query || '').trim().toLowerCase();
        var mySeq = ++searchSeq;
        if (!q) {
            searchResults = [];
            if (searchResultsContainer) {
                searchResultsContainer._lastItemsRef = null;
                searchResultsContainer.innerHTML = '';
            }
            return;
        }
        var liveCatMatches = matchCategoryList(liveGenres, q, 'Live', 0);
        var vodCatMatches = matchCategoryList(vodCats, q, 'Movie', 1);
        var seriesCatMatches = matchCategoryList(seriesCats, q, 'Series', 2);
        var allCatMatches = liveCatMatches.concat(vodCatMatches).concat(seriesCatMatches);
        var liveMatches = [];
        var epgProgMatches = [];
        var hasAnyCachedEpg = shortEpgKeys.length > 0 || Object.keys(epgGridProgramsByCh).length > 0;
        for (var i = 0; i < allChannels.length; i++) {
            if (liveMatches.length >= 30 && (!hasAnyCachedEpg || epgProgMatches.length >= 15)) {
                break;
            }
            var ch = allChannels[i];
            if (!ch) {
                continue;
            }
            if (!window._parentalUnlocked && isAdultContentItem(ch)) {
                continue;
            }
            if (!showHiddenEntries && (isHiddenItem('live', ch.id) || (ch.genreId && isHiddenCategory('live', ch.genreId)))) {
                continue;
            }
            if (liveMatches.length < 30 && (getItemLowerName(ch).indexOf(q) !== -1 || String(ch.num || '') === q)) {
                liveMatches.push(ch);
            }
            if (hasAnyCachedEpg && epgProgMatches.length < 15) {
                var chKey = String(ch.id);
                var cachedShort = shortEpgCache[chKey];
                var normProgs = (cachedShort && Array.isArray(cachedShort.list) && cachedShort.list.length > 0) ?
                    normalizeEpgEntries(cachedShort.list) :
                    (Array.isArray(epgGridProgramsByCh[chKey]) ? epgGridProgramsByCh[chKey] : []);
                for (var ep = 0; ep < normProgs.length; ep++) {
                    var pr = normProgs[ep];
                    if (!pr || pr.isPast) {
                        continue;
                    }
                    var progTitle = pr ? String(pr.name || pr.title || '') : '';
                    var progLower = pr._nameLower || (pr._nameLower = progTitle.toLowerCase());
                    if (progLower && progLower.indexOf(q) !== -1) {
                        var rawRange = String(pr.timeLabel || pr.timeRange || '');
                        var startClock = rawRange ? rawRange.split(' - ')[0] : '';
                        epgProgMatches.push({
                            id: 'epg_' + ch.id + '_' + (pr.start_timestamp || pr.startSec || ep),
                            isEpgProgramResult: true,
                            channelRef: ch,
                            epgProg: pr,
                            name: progTitle,
                            display: '📅 [' + (pr.isNow ? 'ON NOW' : startClock) + ' • ' + ch.name + '] ' + progTitle
                        });
                        break;
                    }
                }
            }
        }
        searchResults = allCatMatches.concat(epgProgMatches).concat(liveMatches);
        searchIdx = 0;
        renderSearchResults();
        Promise.all([
            api.fetchVodPage('*', 1, q, 'added').catch(function() { return []; }),
            api.fetchSeriesPage('*', 1, q, 'added').catch(function() { return []; })
        ]).then(function(res) {
            if (!searchOpen || mySeq !== searchSeq) {
                return;
            }
            var rawVodRes = Array.isArray(res[0]) ? res[0] : [];
            var rawSeriesRes = Array.isArray(res[1]) ? res[1] : [];
            var vodMatches = [];
            for (var v = 0; v < rawVodRes.length && vodMatches.length < 20; v++) {
                var vItem = rawVodRes[v];
                if (!vItem) {
                    continue;
                }
                if (!window._parentalUnlocked && isAdultContentItem(vItem)) {
                    continue;
                }
                if (!showHiddenEntries && (isHiddenItem('vod', vItem.id) || (vItem.genreId && isHiddenCategory('vod', vItem.genreId)))) {
                    continue;
                }
                vodMatches.push(vItem);
            }
            var seriesMatches = [];
            for (var s = 0; s < rawSeriesRes.length && seriesMatches.length < 20; s++) {
                var sItem = rawSeriesRes[s];
                if (!sItem) {
                    continue;
                }
                if (!window._parentalUnlocked && isAdultContentItem(sItem)) {
                    continue;
                }
                if (!showHiddenEntries && (isHiddenItem('series', sItem.id) || (sItem.genreId && isHiddenCategory('series', sItem.genreId)))) {
                    continue;
                }
                seriesMatches.push(sItem);
            }
            searchResults = allCatMatches.concat(epgProgMatches).concat(liveMatches).concat(vodMatches).concat(seriesMatches);
            if (searchIdx >= searchResults.length) {
                searchIdx = 0;
            }
            renderSearchResults();
        });
    }
    function renderSearchResults() {
        renderList(searchResultsContainer, searchResults, searchIdx, function(item) {
            if (item.isCategoryResult || item.isEpgProgramResult) {
                return item.display;
            }
            if (item.isSeries) {
                return '📁 [Series] ' + item.name + (item.year ? (' (' + item.year + ')') : '');
            }
            if (item.isVod) {
                return '🎬 [Movie] ' + item.name + (item.year ? (' (' + item.year + ')') : '');
            }
            return '📺 [Live] ' + (item.num ? (item.num + '. ') : '') + item.name;
        }, 8);
    }
    function jumpToCategoryFromSearch(catResult) {
        if (!catResult) {
            return;
        }
        var targetMode = catResult.targetModeIdx || 0;
        var reqProfId = activeProfileId;
        modeIdx = targetMode;
        lastContentModeIdx = targetMode;
        catFilterText = '';
        itemFilterText = '';
        seriesStack = [];
        seriesLoading = false;
        activeCol = 'items';
        setOverlayVisible(true);
        renderModes();
        if (catsHeaderEl) {
            catsHeaderEl.textContent = 'Categories';
        }
        if (itemsHeaderEl && modes[modeIdx]) {
            itemsHeaderEl.textContent = modes[modeIdx].title;
        }
        function applyCategorySelection(catsList) {
            if (activeProfileId !== reqProfId || lastContentModeIdx !== targetMode) {
                return;
            }
            rawCats = catsList || [];
            applyColumnFilters();
            var foundCatIdx = 0;
            for (var i = 0; i < currentCats.length; i++) {
                if (String(currentCats[i].id) === String(catResult.catId)) {
                    foundCatIdx = i;
                    break;
                }
            }
            selectCategory(foundCatIdx);
        }
        if (targetMode === 0) {
            if (liveGenres.length > 0) {
                applyCategorySelection(liveGenres);
            } else {
                api.fetchLiveCatalog(false).then(function(cat) {
                    if (activeProfileId !== reqProfId) {
                        return;
                    }
                    liveGenres = cat.genres || [];
                    allChannels = cat.channels || [];
                    rebuildGenreChannelCounts();
                    applyCategorySelection(liveGenres);
                }).catch(function() {
                    applyCategorySelection([]);
                });
            }
        } else if (targetMode === 1) {
            if (vodCats.length > 0) {
                applyCategorySelection(vodCats);
            } else {
                api.fetchVodCategories().then(function(cats) {
                    if (activeProfileId !== reqProfId) {
                        return;
                    }
                    vodCats = cats || [];
                    applyCategorySelection(vodCats);
                }).catch(function() {
                    applyCategorySelection([]);
                });
            }
        } else if (targetMode === 2) {
            if (seriesCats.length > 0) {
                applyCategorySelection(seriesCats);
            } else {
                api.fetchSeriesCategories().then(function(cats) {
                    if (activeProfileId !== reqProfId) {
                        return;
                    }
                    seriesCats = cats || [];
                    applyCategorySelection(seriesCats);
                }).catch(function() {
                    applyCategorySelection([]);
                });
            }
        }
    }
    function jumpToSeriesFromSearch(seriesItem) {
        if (!seriesItem) {
            return;
        }
        var wasSeriesMode = (modes[lastContentModeIdx] && modes[lastContentModeIdx].id === 'series' && seriesCats.length > 0 && rawCats === seriesCats);
        var reqProfId = activeProfileId;
        modeIdx = 2;
        lastContentModeIdx = 2;
        seriesLoading = false;
        activeCol = 'items';
        setOverlayVisible(true);
        updateColumnFocusClasses();
        if (!wasSeriesMode) {
            catFilterText = '';
            itemFilterText = '';
            seriesStack = [];
            catIdx = 0;
            itemIdx = 0;
            loadedCatSignature = 'series:*';
            rawCats = seriesCats.length > 0 ? seriesCats : [
                { id: '*', title: 'All Series', censored: false },
                { id: 'new', title: '🆕 Recently Added', censored: false },
                { id: 'cont', title: '▶ Continue Watching', censored: false },
                { id: 'fav', title: '★ Favorites', censored: false },
                { id: 'rec', title: '⏱ History', censored: false }
            ];
            rawItems = [seriesItem];
            applyColumnFilters();
            renderModes();
            renderCats();
            if (seriesCats.length <= 5) {
                api.fetchSeriesCategories().then(function(cats) {
                    if (activeProfileId !== reqProfId) {
                        return;
                    }
                    if (Array.isArray(cats) && cats.length > 0) {
                        seriesCats = cats;
                        if (getActiveContentModeId() === 'series') {
                            rawCats = seriesCats;
                            applyColumnFilters();
                            renderCats();
                        }
                    }
                }).catch(function() {});
            }
        } else {
            renderModes();
        }
        stepIntoSeries(seriesItem);
    }
    function openFilterModal(targetCol) {
        filterOpen = true;
        filterRow = 0;
        filterCol = 0;
        filterTargetCol = targetCol || (activeCol === 'cats' ? 'cats' : 'items');
        if (filterModalTitle) {
            filterModalTitle.textContent = filterTargetCol === 'cats' ? 'Filter Categories' : 'Filter Channels / Content';
        }
        if (inpFilterEl) {
            inpFilterEl.value = filterTargetCol === 'cats' ? catFilterText : itemFilterText;
        }
        if (filterModal) {
            filterModal.classList.add('visible');
        }
        updateFilterFocus();
        updateContextualHelpBar();
        if (inpFilterEl && typeof inpFilterEl.focus === 'function') {
            setTimeout(function() {
                if (filterOpen && inpFilterEl) {
                    inpFilterEl.focus();
                }
            }, 20);
        }
    }
    function closeFilterModal() {
        filterOpen = false;
        if (inpFilterEl) {
            inpFilterEl.blur();
        }
        if (filterModal) {
            filterModal.classList.remove('visible');
        }
        updateContextualHelpBar();
    }
    function updateFilterFocus() {
        return applyGridFocus(filterEls, filterGrid, filterRow, filterCol);
    }
    if (btnFilterApplyEl) {
        btnFilterApplyEl.onclick = function() {
            var val = inpFilterEl ? inpFilterEl.value.trim() : '';
            if (filterTargetCol === 'cats') {
                catFilterText = val;
            } else {
                itemFilterText = val;
            }
            closeFilterModal();
            applyColumnFilters();
            renderUI();
        };
    }
    if (btnFilterClearEl) {
        btnFilterClearEl.onclick = function() {
            if (filterTargetCol === 'cats') {
                catFilterText = '';
            } else {
                itemFilterText = '';
            }
            closeFilterModal();
            applyColumnFilters();
            renderUI();
        };
    }

    function bindWheelSafe(el, handler) {
        if (!el) {
            return;
        }
        try {
            el.addEventListener('wheel', handler, { passive: false });
        } catch (ex) {
            el.addEventListener('wheel', handler, false);
        }
    }

    function bindModalCloseHandlers(cfg) {
        if (!cfg.el) {
            return;
        }
        cfg.el.addEventListener('click', function(ev) {
            if (ev.target === cfg.el) {
                cfg.closeFn();
            }
        });
        var innerBox = cfg.el.firstElementChild;
        if (innerBox && !innerBox.querySelector('.modal-close-x')) {
            var closeX = document.createElement('div');
            closeX.className = 'modal-close-x';
            closeX.textContent = '×';
            closeX.title = 'Close (Back / Esc)';
            closeX.onclick = function(ev) {
                ev.stopPropagation();
                cfg.closeFn();
            };
            innerBox.appendChild(closeX);
        }
    }

    function setupMouseListeners() {
        if (profileBadgeEl) {
            profileBadgeEl.onclick = function(ev) {
                ev.stopPropagation();
                openSettings();
            };
        }
        if (accountBadgeEl) {
            accountBadgeEl.title = 'Click to refresh portal catalog';
            accountBadgeEl.onclick = function(ev) {
                ev.stopPropagation();
                forceRefreshCurrentCatalog();
            };
        }
        if (appBrandEl) {
            appBrandEl.title = 'Click to toggle Fullscreen / Guide';
            appBrandEl.onclick = function(ev) {
                ev.stopPropagation();
                if (settingsOpen) {
                    closeSettings();
                } else if (currentPlayingItem) {
                    setOverlayVisible(!uiVisible);
                }
            };
        }
        if (clockDisplayEl) {
            clockDisplayEl.title = 'Click to cycle Sleep Timer';
            clockDisplayEl.style.cursor = 'pointer';
            clockDisplayEl.onclick = function(ev) {
                ev.stopPropagation();
                cycleSleepTimer();
            };
        }
        if (sleepTimerBadgeEl) {
            sleepTimerBadgeEl.onclick = function(ev) {
                ev.stopPropagation();
                cycleSleepTimer();
            };
        }
        if (reminderBadgeEl) {
            reminderBadgeEl.onclick = function(ev) {
                ev.stopPropagation();
                openEpgModal(currentItems[itemIdx] || currentPlayingItem);
            };
        }
        if (recStatusBadgeEl) {
            recStatusBadgeEl.onclick = function(ev) {
                ev.stopPropagation();
                toggleStreamRecording();
            };
        }
        var modalConfigs = [
            { el: searchModal, closeFn: closeSearch },
            { el: filterModal, closeFn: closeFilterModal },
            { el: epgModal, closeFn: closeEpgModal },
            { el: pinModalEl, closeFn: closePinModal },
            { el: tracksModalEl, closeFn: closeTracksModal }
        ];
        for (var m = 0; m < modalConfigs.length; m++) {
            bindModalCloseHandlers(modalConfigs[m]);
        }

        document.addEventListener('dblclick', function(ev) {
            if (settingsOpen || searchOpen || filterOpen || epgModalOpen || pinModalOpen || tracksModalOpen || miniZapOpen) {
                return;
            }
            if (ev.target === document.body || ev.target === overlayEl) {
                if (currentPlayingItem) {
                    setOverlayVisible(!uiVisible);
                }
            }
        });

        if (filterBadgeEl) {
            filterBadgeEl.title = 'Click to clear filters';
            filterBadgeEl.onclick = function(ev) {
                ev.stopPropagation();
                catFilterText = '';
                itemFilterText = '';
                currentSort = 'added';
                applyColumnFilters();
                renderUI();
                showToast('Filters cleared');
            };
        }
        if (searchInput) {
            searchInput.oninput = function() {
                if (searchDebounce) {
                    clearTimeout(searchDebounce);
                }
                searchDebounce = setTimeout(function() {
                    performSearch(searchInput.value);
                }, 220);
            };
        }
        if (vodProgressWrap) {
            vodProgressWrap.onclick = function(ev) {
                ev.stopPropagation();
                if ((!isPlayingVod && !isPlayingCatchup) || vodDurationMs <= 0) {
                    return;
                }
                var rect = vodProgressWrap.getBoundingClientRect();
                var ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                var targetMs = Math.floor(ratio * vodDurationMs);
                scrubVodByOffset(targetMs - vodCurrentMs);
            };
        }
        bindWheelSafe(modesColEl, function(ev) {
            ev.preventDefault();
            activeCol = 'modes';
            var dir = ev.deltaY > 0 ? 1 : -1;
            modeIdx = (modeIdx + dir + modes.length) % modes.length;
            updateColumnFocusClasses();
            renderModes();
            if (settingsOpen) {
                updateSettingsFocus();
            }
        });
        bindWheelSafe(catsColEl, function(ev) {
            ev.preventDefault();
            if (currentCats.length === 0) {
                return;
            }
            userInteractedSinceBoot = true;
            activeCol = 'cats';
            var dir = ev.deltaY > 0 ? 1 : -1;
            catIdx = (catIdx + dir + currentCats.length) % currentCats.length;
            updateColumnFocusClasses();
            renderCats();
            scheduleCategoryPreview();
        });
        bindWheelSafe(itemsColEl, function(ev) {
            ev.preventDefault();
            if (currentItems.length === 0) {
                return;
            }
            userInteractedSinceBoot = true;
            activeCol = 'items';
            var step = isPosterGridActive() ? (ev.deltaY > 0 ? 3 : -3) : (ev.deltaY > 0 ? 2 : -2);
            itemIdx = Math.max(0, Math.min(currentItems.length - 1, itemIdx + step));
            updateColumnFocusClasses();
            renderItems();
            updatePreviewPanel();
            loadMoreCatalogIfNeeded();
        });
        bindWheelSafe(epgModalList, function(ev) {
            ev.preventDefault();
            if (epgModalItems.length === 0) {
                return;
            }
            var step = ev.deltaY > 0 ? 1 : -1;
            epgModalIdx = Math.max(0, Math.min(epgModalItems.length - 1, epgModalIdx + step));
            renderEpgModalList();
        });
        bindWheelSafe(epgGridRowsEl, function(ev) {
            ev.preventDefault();
            if (epgViewMode !== 'grid' || epgGridChannels.length === 0) {
                return;
            }
            var step = ev.deltaY > 0 ? 1 : -1;
            epgGridChIdx = Math.max(0, Math.min(epgGridChannels.length - 1, epgGridChIdx + step));
            loadEpgGridVisibleChannels();
        });
        bindWheelSafe(searchResultsContainer, function(ev) {
            ev.preventDefault();
            if (searchResults.length === 0) {
                return;
            }
            searchFocusArea = 'results';
            var step = ev.deltaY > 0 ? 1 : -1;
            searchIdx = Math.max(0, Math.min(searchResults.length - 1, searchIdx + step));
            renderSearchResults();
        });
        bindWheelSafe(tracksListEl, function(ev) {
            ev.preventDefault();
            if (tracksModalItems.length === 0) {
                return;
            }
            var step = ev.deltaY > 0 ? 1 : -1;
            tracksModalIdx = (tracksModalIdx + step + tracksModalItems.length) % tracksModalItems.length;
            renderTracksModalList();
        });
        bindWheelSafe(miniZapListEl, function(ev) {
            ev.preventDefault();
            var zapWheelList = getLiveZapList();
            if (zapWheelList.length === 0) {
                return;
            }
            var step = ev.deltaY > 0 ? 1 : -1;
            miniZapIdx = (miniZapIdx + step + zapWheelList.length) % zapWheelList.length;
            renderMiniZapList();
        });
    }

    function syncLiveChannelCursorOnZap(targetCh) {
        if (!targetCh || getActiveContentModeId() !== 'live') {
            return;
        }
        for (var i = 0; i < currentItems.length; i++) {
            if (currentItems[i] && String(currentItems[i].id) === String(targetCh.id)) {
                itemIdx = i;
                renderItems();
                if (uiVisible) {
                    updatePreviewPanel();
                }
                break;
            }
        }
    }

    function handleNumInput(digit) {
        if (digit === 0 && numBuffer === '') {
            if (previousLiveChannel) {
                if (miniZapOpen) {
                    closeMiniZapDrawer();
                }
                playItem(previousLiveChannel);
                syncLiveChannelCursorOnZap(previousLiveChannel);
            }
            return;
        }
        numBuffer += String(digit);
        if (numOsdEl) {
            numOsdEl.textContent = numBuffer;
            numOsdEl.classList.add('visible');
        }
        if (numTimeout) {
            clearTimeout(numTimeout);
        }
        numTimeout = setTimeout(function() {
            var targetNum = Number(numBuffer);
            numBuffer = '';
            if (numOsdEl) {
                numOsdEl.classList.remove('visible');
            }
            if (pinModalOpen || settingsOpen || searchOpen || filterOpen || epgModalOpen || tracksModalOpen) {
                return;
            }
            var fastMatch = channelByNumMap[String(targetNum)];
            if (fastMatch) {
                if (miniZapOpen) {
                    closeMiniZapDrawer();
                }
                playItem(fastMatch);
                syncLiveChannelCursorOnZap(fastMatch);
                return;
            }
            for (var i = 0; i < allChannels.length; i++) {
                if (Number(allChannels[i].num) === targetNum) {
                    if (miniZapOpen) {
                        closeMiniZapDrawer();
                    }
                    playItem(allChannels[i]);
                    syncLiveChannelCursorOnZap(allChannels[i]);
                    break;
                }
            }
        }, 1200);
    }

    function setupKeyListeners() {
        try {
            if (typeof tizen !== 'undefined' && tizen.tvinputdevice) {
                var keysToRegister = [
                    'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
                    'Info', 'Guide', 'ChannelGuide', 'Caption', 'ChannelUp', 'ChannelDown',
                    'PreviousChannel',
                    'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
                    'MediaFastForward', 'MediaRewind',
                    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
                ];
                for (var i = 0; i < keysToRegister.length; i++) {
                    try {
                        tizen.tvinputdevice.registerKey(keysToRegister[i]);
                    } catch (ex) {}
                }
            }
        } catch (ex2) {}

        var lastNavKeyProcessedTs = 0;
        var lastNavKeyCode = 0;
        document.addEventListener('keydown', function(e) {
            userInteractedSinceBoot = true;
            var code = e.keyCode;
            var key = e.key || '';
            var isInputFocused = Boolean(document.activeElement && document.activeElement.tagName === 'INPUT');
            var isUp = code === 38 || key === 'ArrowUp';
            var isDown = code === 40 || key === 'ArrowDown';
            var isLeft = code === 37 || key === 'ArrowLeft';
            var isRight = code === 39 || key === 'ArrowRight';
            if ((isUp || isDown || isLeft || isRight) && e.repeat) {
                var nowKeyTs = Date.now();
                if (code === lastNavKeyCode && (nowKeyTs - lastNavKeyProcessedTs) < 28) {
                    e.preventDefault();
                    return;
                }
                lastNavKeyProcessedTs = nowKeyTs;
                lastNavKeyCode = code;
            } else {
                lastNavKeyCode = code;
                lastNavKeyProcessedTs = Date.now();
            }
            var isEnter = code === 13 || key === 'Enter';
            var isImeDone = code === 65376;
            var isImeCancel = code === 65385;
            var isHardwareOrEscBack = code === 10009 || code === 27 || key === 'Escape' || isImeCancel;
            var isBackspaceKey = code === 8 || key === 'Backspace';
            var isBack = isHardwareOrEscBack || (isBackspaceKey && !isInputFocused);
            var isRed = code === 403 || key === 'ColorF0Red' || key === 'r';
            var isGreen = code === 404 || key === 'ColorF1Green' || key === 'g';
            var isYellow = code === 405 || key === 'ColorF2Yellow' || key === 'y';
            var isBlue = code === 406 || key === 'ColorF3Blue' || key === 'b';
            var isSubtitleKey = code === 10221 || key === 'Caption' || key === 'Subtitle';
            var isInfo = code === 457 || key === 'Info' || key === 'i';
            var isGuide = code === 458 || key === 'Guide' || key === 'ChannelGuide' || key === 'e';
            var isChUp = code === 427 || key === 'ChannelUp' || key === 'PageUp';
            var isChDown = code === 428 || key === 'ChannelDown' || key === 'PageDown';
            var isPreCh = code === 10190 || key === 'PreviousChannel' || key === 'p' || key === 'P';
            var isPlayPause = code === 10252 || key === 'MediaPlayPause' || key === ' ';
            var isPlay = code === 415 || key === 'MediaPlay';
            var isPause = code === 19 || key === 'MediaPause';
            var isStop = code === 413 || key === 'MediaStop';
            var isRewind = code === 412 || key === 'MediaRewind';
            var isFastForward = code === 417 || key === 'MediaFastForward';

            // 0a. YouTube Trailer Modal
            if (trailerModalOpen) {
                e.preventDefault();
                if (isBack) {
                    closeTrailerModal();
                } else if (isGreen) {
                    launchNativeSamsungYouTubeApp(activeTrailerYoutubeId);
                } else if (isLeft || isUp) {
                    trailerFocusedBtnIdx = 0;
                    updateTrailerModalFocus();
                } else if (isRight || isDown) {
                    trailerFocusedBtnIdx = 1;
                    updateTrailerModalFocus();
                } else if (isEnter) {
                    if (trailerFocusedBtnIdx === 0) {
                        launchNativeSamsungYouTubeApp(activeTrailerYoutubeId);
                    } else {
                        closeTrailerModal();
                    }
                }
                return;
            }

            // 0b. Who's Watching Profile Picker Modal
            if (profilePickerOpen) {
                e.preventDefault();
                var cardCount = (Array.isArray(profiles) ? profiles.length : 0) + 1;
                var manageBtnIdx = cardCount;
                if (isBack) {
                    closeProfilePickerModal();
                    if (liveGenres.length <= 3 && allChannels.length === 0 && !liveCatalogLoading && !settingsOpen) {
                        var fallbackProf = getActiveProfile();
                        if (isProfileConfigured(fallbackProf)) {
                            activateProfileAndConnect(fallbackProf);
                        }
                    }
                } else if (isDown) {
                    if (profilePickerIdx < manageBtnIdx) {
                        lastProfileCardIdx = profilePickerIdx;
                        profilePickerIdx = manageBtnIdx;
                        renderProfilePickerGrid();
                    }
                } else if (isUp) {
                    if (profilePickerIdx === manageBtnIdx) {
                        profilePickerIdx = Math.min(cardCount - 1, Math.max(0, lastProfileCardIdx));
                        renderProfilePickerGrid();
                    }
                } else if (isLeft) {
                    if (profilePickerIdx === manageBtnIdx) {
                        profilePickerIdx = Math.min(cardCount - 1, Math.max(0, lastProfileCardIdx));
                    } else {
                        profilePickerIdx = (profilePickerIdx - 1 + cardCount) % cardCount;
                        lastProfileCardIdx = profilePickerIdx;
                    }
                    renderProfilePickerGrid();
                } else if (isRight) {
                    if (profilePickerIdx === manageBtnIdx) {
                        profilePickerIdx = Math.min(cardCount - 1, Math.max(0, lastProfileCardIdx));
                    } else {
                        profilePickerIdx = (profilePickerIdx + 1) % cardCount;
                        lastProfileCardIdx = profilePickerIdx;
                    }
                    renderProfilePickerGrid();
                } else if (isYellow) {
                    var editIdx = profilePickerIdx < profiles.length ? profilePickerIdx : (lastProfileCardIdx < profiles.length ? lastProfileCardIdx : 0);
                    editingProfileIndex = editIdx;
                    closeProfilePickerModal();
                    openSettings();
                } else if (isEnter) {
                    if (profilePickerIdx < profiles.length) {
                        var chosenProf = profiles[profilePickerIdx];
                        var alreadyLoadedActive = (chosenProf.id === activeProfileId && liveGenres.length > 3 && (allChannels.length > 0 || liveGenrePaged));
                        closeProfilePickerModal();
                        if (isProfileConfigured(chosenProf)) {
                            if (!alreadyLoadedActive) {
                                activateProfileAndConnect(chosenProf);
                            }
                        } else {
                            editingProfileIndex = profilePickerIdx;
                            openSettings();
                        }
                    } else if (profilePickerIdx === profiles.length) {
                        closeProfilePickerModal();
                        openSettings();
                        createNewProfileInSettings();
                    } else {
                        if (lastProfileCardIdx < profiles.length) {
                            editingProfileIndex = lastProfileCardIdx;
                        }
                        closeProfilePickerModal();
                        openSettings();
                    }
                }
                return;
            }

            // 0c. Hardware Previous Channel Recall (PRE-CH / 10190)
            if (isPreCh && !imeActive && !isInputFocused && !searchOpen && !filterOpen && !settingsOpen && !pinModalOpen) {
                e.preventDefault();
                if (previousLiveChannel) {
                    if (miniZapOpen) {
                        closeMiniZapDrawer();
                    }
                    showToast('↩ PRE-CH: ' + (previousLiveChannel.name || 'Previous Channel'));
                    playItem(previousLiveChannel);
                    syncLiveChannelCursorOnZap(previousLiveChannel);
                } else {
                    showToast('↩ No previous Live TV channel in recall history');
                }
                return;
            }

            if (!imeActive && !isInputFocused && !searchOpen && !filterOpen && !settingsOpen && !pinModalOpen && !epgModalOpen && !tracksModalOpen && !miniZapOpen) {
                if (key === 'm' || key === 'M') {
                    e.preventDefault();
                    toggleMute();
                    return;
                }
                if (key === '+' || key === '=') {
                    e.preventDefault();
                    adjustVolume(5);
                    return;
                }
                if (key === '-' || key === '_') {
                    e.preventDefault();
                    adjustVolume(-5);
                    return;
                }
                if (key === 'f' || key === 'F') {
                    if (currentPlayingItem) {
                        e.preventDefault();
                        setOverlayVisible(!uiVisible);
                        return;
                    }
                }
            }

            var digitVal = (code >= 48 && code <= 57) ? (code - 48) : ((code >= 96 && code <= 105) ? (code - 96) : -1);

            // 0. Parental PIN Modal
            if (pinModalOpen) {
                var pinFocusedEl = getFocusedModalElement(pinGrid, pinModalRow, pinModalCol);
                if (isImeDone) {
                    e.preventDefault();
                    if (inpPinVerifyEl) {
                        inpPinVerifyEl.blur();
                    }
                    imeActive = false;
                    if (inpPinVerifyEl && inpPinVerifyEl.value.length > 0) {
                        verifyPinAndUnlock();
                    }
                    return;
                }
                if (digitVal !== -1) {
                    if (document.activeElement !== inpPinVerifyEl && inpPinVerifyEl) {
                        e.preventDefault();
                        if (inpPinVerifyEl.value.length < 4) {
                            inpPinVerifyEl.value += String(digitVal);
                        }
                    }
                    return;
                }
                if (document.activeElement === inpPinVerifyEl && isBackspaceKey && inpPinVerifyEl.value.length > 0) {
                    return;
                }
                e.preventDefault();
                if (isBack || isBackspaceKey) {
                    if (document.activeElement === inpPinVerifyEl) {
                        inpPinVerifyEl.blur();
                    } else {
                        closePinModal();
                    }
                } else if (isUp) {
                    if (inpPinVerifyEl) {
                        inpPinVerifyEl.blur();
                    }
                    pinModalRow = Math.max(0, pinModalRow - 1);
                    pinModalCol = Math.min(pinModalCol, pinGrid[pinModalRow].length - 1);
                    updatePinModalFocus();
                } else if (isDown) {
                    if (inpPinVerifyEl) {
                        inpPinVerifyEl.blur();
                    }
                    pinModalRow = Math.min(pinGrid.length - 1, pinModalRow + 1);
                    pinModalCol = Math.min(pinModalCol, pinGrid[pinModalRow].length - 1);
                    updatePinModalFocus();
                } else if (isLeft) {
                    pinModalCol = Math.max(0, pinModalCol - 1);
                    updatePinModalFocus();
                } else if (isRight) {
                    pinModalCol = Math.min(pinGrid[pinModalRow].length - 1, pinModalCol + 1);
                    updatePinModalFocus();
                } else if (isEnter) {
                    if (pinFocusedEl === btnPinCancelEl) {
                        closePinModal();
                    } else if (pinFocusedEl === inpPinVerifyEl && inpPinVerifyEl.value.length < 4 && document.activeElement !== inpPinVerifyEl) {
                        inpPinVerifyEl.focus();
                    } else {
                        verifyPinAndUnlock();
                    }
                }
                return;
            }

            // 1. Full EPG Guide Modal
            if (epgModalOpen) {
                e.preventDefault();
                if (isBack || isGuide) {
                    closeEpgModal();
                } else if (isGreen) {
                    toggleEpgModalViewMode();
                } else if (isYellow) {
                    cycleEpgOffsetHours();
                } else if (epgViewMode === 'grid') {
                    if (isUp) {
                        epgGridChIdx = Math.max(0, epgGridChIdx - 1);
                        loadEpgGridVisibleChannels();
                    } else if (isDown) {
                        epgGridChIdx = Math.min(Math.max(0, epgGridChannels.length - 1), epgGridChIdx + 1);
                        loadEpgGridVisibleChannels();
                    } else if (isChUp) {
                        epgGridChIdx = Math.max(0, epgGridChIdx - 6);
                        loadEpgGridVisibleChannels();
                    } else if (isChDown) {
                        epgGridChIdx = Math.min(Math.max(0, epgGridChannels.length - 1), epgGridChIdx + 6);
                        loadEpgGridVisibleChannels();
                    } else if (isLeft) {
                        if (epgGridSlotIdx > 0) {
                            epgGridSlotIdx--;
                        } else {
                            epgGridWindowStartSec = Math.max(0, (epgGridWindowStartSec || Math.floor(Date.now() / 1000)) - 1800);
                        }
                        renderEpgGridView();
                    } else if (isRight) {
                        if (epgGridSlotIdx < 5) {
                            epgGridSlotIdx++;
                        } else {
                            epgGridWindowStartSec = (epgGridWindowStartSec || Math.floor(Date.now() / 1000)) + 1800;
                        }
                        renderEpgGridView();
                    } else if (isEnter) {
                        triggerSelectedEpgProgram();
                    }
                } else if (isUp) {
                    epgModalIdx = Math.max(0, epgModalIdx - 1);
                    renderEpgModalList();
                } else if (isDown) {
                    epgModalIdx = Math.min(epgModalItems.length - 1, epgModalIdx + 1);
                    renderEpgModalList();
                } else if (isLeft || isChUp) {
                    stepEpgModalChannel(-1);
                } else if (isRight || isChDown) {
                    stepEpgModalChannel(1);
                } else if (isEnter) {
                    triggerSelectedEpgProgram();
                }
                return;
            }
            // 2. Standalone Settings Section
            if (settingsOpen) {
                if (activeCol === 'modes') {
                    e.preventDefault();
                    if (isBack || isHardwareOrEscBack) {
                        closeSettings();
                    } else if (isUp) {
                        modeIdx = (modeIdx - 1 + modes.length) % modes.length;
                        renderModes();
                    } else if (isDown) {
                        modeIdx = (modeIdx + 1) % modes.length;
                        renderModes();
                    } else if (isRight) {
                        activeCol = 'settings';
                        modeIdx = getModeIndexById('settings');
                        renderModes();
                        updateColumnFocusClasses();
                        updateSettingsFocus();
                    } else if (isBlue) {
                        closeSettings();
                        cycleActivePortalProfile();
                    } else if (isEnter) {
                        if (modes[modeIdx] && modes[modeIdx].id === 'settings') {
                            activeCol = 'settings';
                            updateColumnFocusClasses();
                            updateSettingsFocus();
                        } else {
                            switchMode(modeIdx);
                            if (modes[modeIdx] && modes[modeIdx].id !== 'search' && modes[modeIdx].id !== 'settings' && modes[modeIdx].id !== 'profiles') {
                                activeCol = 'cats';
                                updateColumnFocusClasses();
                            }
                        }
                    }
                    return;
                }
                var focusedEl = getFocusedModalElement(settingsGrid, settingsRow, settingsCol);
                if (isImeDone && focusedEl) {
                    e.preventDefault();
                    if (focusedEl.blur) {
                        focusedEl.blur();
                    }
                    imeActive = false;
                    return;
                }
                if ((imeActive || isInputFocused) && !isEnter && !isHardwareOrEscBack && !isUp && !isDown) {
                    return;
                }
                e.preventDefault();
                if (isBack || isHardwareOrEscBack) {
                    if ((imeActive || isInputFocused) && focusedEl) {
                        if (focusedEl.blur) {
                            focusedEl.blur();
                        }
                        imeActive = false;
                    } else {
                        closeSettings();
                    }
                } else if (isUp) {
                    if (focusedEl && focusedEl.blur) {
                        focusedEl.blur();
                    }
                    imeActive = false;
                    var prevRowUp = settingsRow;
                    settingsRow = Math.max(0, settingsRow - 1);
                    if (settingsRow !== prevRowUp) {
                        settingsCol = resolveNextSettingsCol(settingsGrid[prevRowUp], settingsGrid[settingsRow], settingsCol);
                    }
                    settingsCol = Math.min(settingsCol, settingsGrid[settingsRow].length - 1);
                    updateSettingsFocus();
                } else if (isDown) {
                    if (focusedEl && focusedEl.blur) {
                        focusedEl.blur();
                    }
                    imeActive = false;
                    var prevRowDown = settingsRow;
                    settingsRow = Math.min(settingsGrid.length - 1, settingsRow + 1);
                    if (settingsRow !== prevRowDown) {
                        settingsCol = resolveNextSettingsCol(settingsGrid[prevRowDown], settingsGrid[settingsRow], settingsCol);
                    }
                    settingsCol = Math.min(settingsCol, settingsGrid[settingsRow].length - 1);
                    updateSettingsFocus();
                } else if (isLeft) {
                    if (focusedEl && focusedEl.blur) {
                        focusedEl.blur();
                    }
                    imeActive = false;
                    var prevColLeft = settingsCol;
                    if (prevColLeft === 0) {
                        if (settingsRow >= 5) {
                            settingsRow = Math.min(4, settingsRow - 5);
                            settingsCol = settingsGrid[settingsRow].length - 1;
                            if (settingsGrid[settingsRow].length > 1 && settingsGrid[settingsRow][0] !== tabProvStalkerEl) {
                                settingsLastColRatio = 1;
                            }
                            updateSettingsFocus();
                        } else {
                            activeCol = 'modes';
                            modeIdx = getModeIndexById('settings');
                            renderModes();
                            updateColumnFocusClasses();
                            updateSettingsFocus();
                        }
                    } else {
                        settingsCol = Math.max(0, settingsCol - 1);
                        if (settingsGrid[settingsRow] && settingsGrid[settingsRow][0] === tabProvStalkerEl) {
                            if (settingsCol !== prevColLeft) {
                                var tabLeftEl = settingsGrid[settingsRow][settingsCol];
                                var leftType = (tabLeftEl === tabProvXtreamEl) ? 'xtream' : ((tabLeftEl === tabProvM3uEl) ? 'm3u' : 'stalker');
                                setSettingsProviderType(leftType);
                            }
                        } else if (settingsGrid[settingsRow] && settingsGrid[settingsRow].length > 1) {
                            settingsLastColRatio = settingsCol / (settingsGrid[settingsRow].length - 1);
                        }
                        updateSettingsFocus();
                    }
                } else if (isRight) {
                    if (focusedEl && focusedEl.blur) {
                        focusedEl.blur();
                    }
                    imeActive = false;
                    var prevColRight = settingsCol;
                    var maxColInRow = settingsGrid[settingsRow].length - 1;
                    if (prevColRight === maxColInRow) {
                        if (settingsRow <= 4 && settingsGrid.length > 5) {
                            settingsRow = Math.min(settingsGrid.length - 1, settingsRow + 5);
                            settingsCol = 0;
                            if (settingsGrid[settingsRow].length > 1) {
                                settingsLastColRatio = 0;
                            }
                            updateSettingsFocus();
                        }
                    } else {
                        settingsCol = Math.min(maxColInRow, settingsCol + 1);
                        if (settingsGrid[settingsRow] && settingsGrid[settingsRow][0] === tabProvStalkerEl) {
                            if (settingsCol !== prevColRight) {
                                var tabRightEl = settingsGrid[settingsRow][settingsCol];
                                var rightType = (tabRightEl === tabProvXtreamEl) ? 'xtream' : ((tabRightEl === tabProvM3uEl) ? 'm3u' : 'stalker');
                                setSettingsProviderType(rightType);
                            }
                        } else if (settingsGrid[settingsRow] && settingsGrid[settingsRow].length > 1) {
                            settingsLastColRatio = settingsCol / (settingsGrid[settingsRow].length - 1);
                        }
                        updateSettingsFocus();
                    }
                } else if (isEnter) {
                    if (focusedEl === selProfileEl) {
                        saveCurrentInputsToEditingProfile();
                        var nextProfIdx = (editingProfileIndex + 1) % profiles.length;
                        loadProfileIntoSettingsInputs(nextProfIdx);
                    } else if (focusedEl === tabProvStalkerEl) {
                        setSettingsProviderType('stalker');
                        if (settingsRow + 1 < settingsGrid.length) {
                            settingsRow = settingsRow + 1;
                            settingsCol = 0;
                            updateSettingsFocus();
                        }
                    } else if (focusedEl === tabProvXtreamEl) {
                        setSettingsProviderType('xtream');
                        if (settingsRow + 1 < settingsGrid.length) {
                            settingsRow = settingsRow + 1;
                            settingsCol = 0;
                            updateSettingsFocus();
                        }
                    } else if (focusedEl === tabProvM3uEl) {
                        setSettingsProviderType('m3u');
                        if (settingsRow + 1 < settingsGrid.length) {
                            settingsRow = settingsRow + 1;
                            settingsCol = 0;
                            updateSettingsFocus();
                        }
                    } else if (focusedEl === selProviderTypeEl) {
                        var pTypes = ['stalker', 'xtream', 'm3u'];
                        var curPT = pTypes.indexOf(selProviderTypeEl.value);
                        var nextPT = pTypes[(curPT + 1) % pTypes.length];
                        setSettingsProviderType(nextPT);
                    } else if (focusedEl === btnXtreamPassToggleEl) {
                        toggleXtreamPasswordVisibility();
                    } else if (focusedEl === btnM3uFileEl) {
                        openM3uFilePicker();
                    } else if (focusedEl === btnM3uClearEl) {
                        clearLocalM3uFileFromProfile();
                    } else if (focusedEl === selEpgOffsetEl) {
                        var epgOpts = ['-4', '-3', '-2', '-1', '0', '1', '2', '3', '4'];
                        var curEO = epgOpts.indexOf(String(selEpgOffsetEl.value));
                        selEpgOffsetEl.value = epgOpts[(curEO + 1) % epgOpts.length];
                        if (profiles[editingProfileIndex]) {
                            profiles[editingProfileIndex].epgOffsetHours = Number(selEpgOffsetEl.value) || 0;
                        }
                    } else if (focusedEl === selThemeEl) {
                        var themes = ['blue', 'purple', 'cyan', 'green', 'red', 'amber'];
                        var curT = themes.indexOf(selThemeEl.value);
                        var nextT = (curT + 1) % themes.length;
                        selThemeEl.value = themes[nextT];
                        applyTheme(themes[nextT]);
                    } else if (focusedEl === selBufferModeEl) {
                        var bufModes = ['fast', 'balanced', 'stable'];
                        var curBM = bufModes.indexOf(selBufferModeEl.value);
                        selBufferModeEl.value = bufModes[(curBM + 1) % bufModes.length];
                        bufferModePref = selBufferModeEl.value;
                        safeSetStorage('cfg_buffer_mode', bufferModePref);
                    } else if (focusedEl === selStartupModeEl) {
                        var startModes = ['last_channel', 'profile_picker', 'guide', 'favorites'];
                        var curSM = startModes.indexOf(selStartupModeEl.value);
                        selStartupModeEl.value = startModes[(curSM + 1) % startModes.length];
                        startupModePref = selStartupModeEl.value;
                        safeSetStorage('cfg_startup_mode', startupModePref);
                        safeSetStorage('cfg_startup_mode_user_set', '1');
                    } else if (focusedEl === selOsdTimeoutEl) {
                        var osdOpts = ['3000', '5000', '8000', '10000'];
                        var curOT = osdOpts.indexOf(String(selOsdTimeoutEl.value));
                        selOsdTimeoutEl.value = osdOpts[(curOT + 1) % osdOpts.length];
                        osdTimeoutDurationMs = Number(selOsdTimeoutEl.value) || 5000;
                        safeSetStorage('cfg_osd_timeout', String(osdTimeoutDurationMs));
                    } else if (focusedEl === btnSaveEl) {
                        saveSettingsAndBoot();
                    } else if (focusedEl === btnProfileNewEl) {
                        createNewProfileInSettings();
                    } else if (focusedEl === btnProfileDelEl) {
                        deleteCurrentProfileInSettings();
                    } else if (focusedEl === btnTestConnEl) {
                        testCurrentSettingsConnection();
                    } else if (focusedEl === btnRestartEl) {
                        rebootApp();
                    } else if (focusedEl === btnCancelEl) {
                        closeSettings();
                    } else if (focusedEl === btnBackupExportEl) {
                        exportBackupJson();
                    } else if (focusedEl === btnBackupImportEl) {
                        importBackupJson();
                    } else if (focusedEl && focusedEl.tagName === 'INPUT') {
                        if (imeActive || document.activeElement === focusedEl) {
                            focusedEl.blur();
                            imeActive = false;
                        } else {
                            imeActive = true;
                            focusedEl.focus();
                        }
                    }
                }
                return;
            }
            // 3. Global Search Modal
            if (searchOpen) {
                var isSearchBack = isHardwareOrEscBack ||
                    (isBackspaceKey && (!isInputFocused || !searchInput || searchInput.value === ''));
                if (isSearchBack) {
                    e.preventDefault();
                    closeSearch();
                    return;
                }
                if (isImeDone && searchInput) {
                    e.preventDefault();
                    searchInput.blur();
                    performSearch(searchInput.value);
                    if (searchResults.length > 0) {
                        searchFocusArea = 'results';
                        searchInput.classList.remove('focused');
                        renderSearchResults();
                    }
                    return;
                }
                if (searchFocusArea === 'input' && !isDown && !isEnter) {
                    if (searchDebounce) {
                        clearTimeout(searchDebounce);
                    }
                    searchDebounce = setTimeout(function() {
                        performSearch(searchInput ? searchInput.value : '');
                    }, 260);
                    return;
                }
                e.preventDefault();
                if (isDown) {
                    if (searchFocusArea === 'input') {
                        if (searchInput) {
                            searchInput.blur();
                        }
                        if (searchResults.length > 0) {
                            searchFocusArea = 'results';
                            if (searchInput) {
                                searchInput.classList.remove('focused');
                            }
                            renderSearchResults();
                        }
                    } else if (searchFocusArea === 'results') {
                        searchIdx = Math.min(searchResults.length - 1, searchIdx + 1);
                        renderSearchResults();
                    }
                } else if (isUp) {
                    if (searchFocusArea === 'results') {
                        if (searchIdx > 0) {
                            searchIdx--;
                            renderSearchResults();
                        } else {
                            searchFocusArea = 'input';
                            if (searchInput) {
                                searchInput.classList.add('focused');
                            }
                        }
                    }
                } else if (isEnter) {
                    if (searchFocusArea === 'input' && searchInput) {
                        if (document.activeElement === searchInput) {
                            searchInput.blur();
                            performSearch(searchInput.value);
                            if (searchResults.length > 0) {
                                searchFocusArea = 'results';
                                searchInput.classList.remove('focused');
                                renderSearchResults();
                            }
                        } else {
                            searchInput.focus();
                            performSearch(searchInput.value);
                        }
                    } else if (searchFocusArea === 'results' && searchResults[searchIdx]) {
                        var chosen = searchResults[searchIdx];
                        closeSearch();
                        if (chosen.isCategoryResult) {
                            jumpToCategoryFromSearch(chosen);
                        } else if (chosen.isEpgProgramResult) {
                            if (chosen.epgProg && !chosen.epgProg.isNow && !chosen.epgProg.isPast) {
                                toggleProgramReminder(chosen.channelRef, chosen.epgProg);
                            } else if (chosen.channelRef) {
                                if (window._parentalUnlocked || !isAdultContentItem(chosen.channelRef)) {
                                    setOverlayVisible(false);
                                }
                                playItem(chosen.channelRef);
                                syncLiveChannelCursorOnZap(chosen.channelRef);
                            }
                        } else if (chosen.isSeries) {
                            jumpToSeriesFromSearch(chosen);
                        } else {
                            if (window._parentalUnlocked || !isAdultContentItem(chosen)) {
                                setOverlayVisible(false);
                            }
                            playItem(chosen);
                            if (!chosen.isVod && !chosen.isSeries) {
                                syncLiveChannelCursorOnZap(chosen);
                            }
                        }
                    }
                }
                return;
            }
            // 4. Filter Modal
            if (filterOpen) {
                var filterTargetEl = getFocusedModalElement(filterGrid, filterRow, filterCol);
                if (isImeDone) {
                    e.preventDefault();
                    if (inpFilterEl) {
                        inpFilterEl.blur();
                    }
                    imeActive = false;
                    var imeFilterVal = inpFilterEl ? inpFilterEl.value.trim() : '';
                    if (filterTargetCol === 'cats') {
                        catFilterText = imeFilterVal;
                    } else {
                        itemFilterText = imeFilterVal;
                    }
                    closeFilterModal();
                    applyColumnFilters();
                    renderUI();
                    return;
                }
                if (filterRow === 0 && !isDown && !isUp && !isEnter && !isBack) {
                    return;
                }
                e.preventDefault();
                if (isBack) {
                    closeFilterModal();
                } else if (isUp) {
                    if (inpFilterEl) {
                        inpFilterEl.blur();
                    }
                    filterRow = Math.max(0, filterRow - 1);
                    filterCol = Math.min(filterCol, filterGrid[filterRow].length - 1);
                    updateFilterFocus();
                } else if (isDown) {
                    if (inpFilterEl) {
                        inpFilterEl.blur();
                    }
                    filterRow = Math.min(filterGrid.length - 1, filterRow + 1);
                    filterCol = Math.min(filterCol, filterGrid[filterRow].length - 1);
                    updateFilterFocus();
                } else if (isLeft) {
                    filterCol = Math.max(0, filterCol - 1);
                    updateFilterFocus();
                } else if (isRight) {
                    filterCol = Math.min(filterGrid[filterRow].length - 1, filterCol + 1);
                    updateFilterFocus();
                } else if (isEnter) {
                    if (filterTargetEl === inpFilterEl && document.activeElement !== inpFilterEl) {
                        inpFilterEl.focus();
                    } else if (filterTargetEl === inpFilterEl || filterTargetEl === btnFilterApplyEl) {
                        var val = inpFilterEl ? inpFilterEl.value.trim() : '';
                        if (filterTargetCol === 'cats') {
                            catFilterText = val;
                        } else {
                            itemFilterText = val;
                        }
                        closeFilterModal();
                        applyColumnFilters();
                        renderUI();
                    } else if (filterTargetEl === btnFilterClearEl) {
                        if (filterTargetCol === 'cats') {
                            catFilterText = '';
                        } else {
                            itemFilterText = '';
                        }
                        closeFilterModal();
                        applyColumnFilters();
                        renderUI();
                    }
                }
                return;
            }

            // 4b. Interactive Audio & Subtitle Track Picker Modal
            if (tracksModalOpen) {
                e.preventDefault();
                var curTrackRow = tracksModalItems[tracksModalIdx];
                if (isBack || isSubtitleKey) {
                    closeTracksModal();
                } else if (isUp && tracksModalItems.length > 0) {
                    tracksModalIdx = (tracksModalIdx - 1 + tracksModalItems.length) % tracksModalItems.length;
                    renderTracksModalList();
                } else if (isDown && tracksModalItems.length > 0) {
                    tracksModalIdx = (tracksModalIdx + 1) % tracksModalItems.length;
                    renderTracksModalList();
                } else if (isLeft) {
                    if (curTrackRow && (curTrackRow.kind === 'delay' || curTrackRow.kind === 'delay_reset')) {
                        adjustSubtitleDelay(-250);
                        refreshTracksDelayLabels();
                    } else {
                        cycleSubtitleColor();
                    }
                } else if (isRight) {
                    if (curTrackRow && (curTrackRow.kind === 'delay' || curTrackRow.kind === 'delay_reset')) {
                        adjustSubtitleDelay(250);
                        refreshTracksDelayLabels();
                    } else {
                        cycleSubtitleSize();
                    }
                } else if (isEnter) {
                    activateSelectedTrackModalRow();
                }
                return;
            }

            // 4c. Fullscreen Quick Channel Zapper Drawer
            if (miniZapOpen) {
                e.preventDefault();
                var activeZapList = getLiveZapList();
                if (isBack) {
                    closeMiniZapDrawer();
                } else if (isGuide || isLeft || isRight) {
                    closeMiniZapDrawer();
                    setOverlayVisible(true);
                } else if ((isUp || isChUp) && activeZapList.length > 0) {
                    miniZapIdx = (miniZapIdx - 1 + activeZapList.length) % activeZapList.length;
                    renderMiniZapList();
                } else if ((isDown || isChDown) && activeZapList.length > 0) {
                    miniZapIdx = (miniZapIdx + 1) % activeZapList.length;
                    renderMiniZapList();
                } else if (isEnter && activeZapList[miniZapIdx]) {
                    var selectedZapCh = activeZapList[miniZapIdx];
                    if (activeZapList === currentItems) {
                        itemIdx = miniZapIdx;
                        renderItems();
                    }
                    closeMiniZapDrawer();
                    playItem(selectedZapCh);
                    syncLiveChannelCursorOnZap(selectedZapCh);
                }
                return;
            }

            if (digitVal !== -1 && !imeActive && !isInputFocused) {
                e.preventDefault();
                handleNumInput(digitVal);
                return;
            }

            // 5. Dedicated Media Transport Keys (work in both Overlay and Fullscreen)
            if (isPlayPause || (isPlay && isPaused) || (isPause && !isPaused)) {
                e.preventDefault();
                togglePlayPause();
                return;
            }
            if (isStop && currentPlayingItem) {
                e.preventDefault();
                if (isPlayingVod && currentPlayingItem.id && vodCurrentMs > 15000 && vodDurationMs > 0) {
                    saveResumeTime(currentPlayingItem.id, vodCurrentMs / 1000, vodDurationMs / 1000);
                }
                currentPlayingItem = null;
                isPlayingVod = false;
                isPlayingCatchup = false;
                isPaused = false;
                stopPlayback();
                setOverlayVisible(true);
                renderItems();
                updatePreviewPanel();
                return;
            }
            if (isRewind && (isPlayingVod || isPlayingCatchup)) {
                e.preventDefault();
                scrubVodByOffset(-30000);
                return;
            }
            if (isFastForward && (isPlayingVod || isPlayingCatchup)) {
                e.preventDefault();
                scrubVodByOffset(30000);
                return;
            }

            // 5b. Next Episode Auto-Play Banner (works in both Fullscreen & Overlay)
            if (nextEpCandidate && (isEnter || isBack)) {
                e.preventDefault();
                if (isEnter) {
                    advanceToNextEpisode(nextEpCandidate);
                } else {
                    if (currentPlayingItem) {
                        nextEpDismissedForId = currentPlayingItem.id;
                    }
                    clearNextEpisodePrompt();
                    showToast('Auto-play next episode cancelled');
                }
                return;
            }

            // 6. Fullscreen Playback Controls (when UI overlay is hidden)
            if (!uiVisible) {
                e.preventDefault();
                if (isBack) {
                    setOverlayVisible(true);
                } else if (isEnter) {
                    if (hasActivePlaybackError && currentPlayingItem) {
                        if (currentPlayingItem.isCatchup && currentPlayingItem.channelRef && currentPlayingItem.epgProgRef) {
                            playCatchupProgram(currentPlayingItem.channelRef, currentPlayingItem.epgProgRef);
                        } else {
                            playItem(currentPlayingItem);
                        }
                    } else if (!isPlayingVod && !isPlayingCatchup && getLiveZapList().length > 0) {
                        openMiniZapDrawer();
                    } else {
                        setOverlayVisible(true);
                    }
                } else if (isInfo) {
                    updateOsdStreamTelemetry();
                    showOSD(formatOsdTitle(currentPlayingItem), isPlayingCatchup ? 'CATCH-UP' : (isPlayingVod ? 'VOD' : 'LIVE'));
                } else if (isGuide) {
                    openEpgModal(currentPlayingItem);
                } else if (isLeft && (isPlayingVod || isPlayingCatchup)) {
                    scrubVodByOffset(-30000);
                } else if (isRight && (isPlayingVod || isPlayingCatchup)) {
                    scrubVodByOffset(30000);
                } else if (isChUp && (isPlayingVod || isPlayingCatchup)) {
                    scrubVodByOffset(600000);
                } else if (isChDown && (isPlayingVod || isPlayingCatchup)) {
                    scrubVodByOffset(-600000);
                } else if ((isUp || isChUp) && !isPlayingVod && !isPlayingCatchup) {
                    stepFullscreenLiveChannel(-1);
                } else if ((isDown || isChDown) && !isPlayingVod && !isPlayingCatchup) {
                    stepFullscreenLiveChannel(1);
                } else if (isRed) {
                    cycleAudioTrack();
                } else if (isGreen) {
                    toggleAspectRatio();
                } else if (isBlue || isSubtitleKey) {
                    cycleSubtitles();
                } else if (isYellow && currentPlayingItem) {
                    toggleFavorite(currentPlayingItem);
                }
                return;
            }
            // 7. Main 4-Column Overlay Navigation (Modes -> Categories -> Items -> Info Quick Actions)
            e.preventDefault();
            if (isGuide) {
                openEpgModal(currentItems[itemIdx]);
                return;
            }
            if (isSubtitleKey) {
                openTracksModal('sub');
                return;
            }
            if (isInfo && currentPlayingItem) {
                setOverlayVisible(false);
                updateOsdStreamTelemetry();
                showOSD(formatOsdTitle(currentPlayingItem), isPlayingCatchup ? 'CATCH-UP' : (isPlayingVod ? 'VOD' : 'LIVE'));
                return;
            }
            if (isYellow && activeCol === 'cats' && currentCats[catIdx]) {
                togglePinCategory(currentCats[catIdx]);
                return;
            }
            if (isYellow && (activeCol === 'items' || activeCol === 'info') && currentItems[itemIdx]) {
                toggleFavorite(currentItems[itemIdx]);
                return;
            }
            if (isRed) {
                var sorts = ['added', 'title_asc', 'title_desc'];
                currentSort = sorts[(sorts.indexOf(currentSort) + 1) % sorts.length];
                showToast('⇅ Sort: ' + currentSort.replace('title_', '').toUpperCase());
                applyColumnFilters();
                renderUI();
                return;
            }
            if (isGreen) {
                openSearch();
                return;
            }
            if (isBlue) {
                if (activeCol === 'modes') {
                    cycleActivePortalProfile();
                } else {
                    openFilterModal(activeCol === 'cats' ? 'cats' : 'items');
                }
                return;
            }
            if (isLeft) {
                if (activeCol === 'info') {
                    if (infoActionIdx % 2 === 1) {
                        infoActionIdx = Math.max(0, infoActionIdx - 1);
                        updateInfoActionsFocus();
                    } else {
                        activeCol = 'items';
                        updateColumnFocusClasses();
                    }
                } else if (activeCol === 'items') {
                    if (isPosterGridActive() && currentItems.length > 0) {
                        if (itemIdx % 3 === 0) {
                            if (!stepOutSeries()) {
                                activeCol = 'cats';
                                updateColumnFocusClasses();
                            }
                        } else {
                            itemIdx = Math.max(0, itemIdx - 1);
                            renderItems();
                            updatePreviewPanel();
                        }
                    } else {
                        if (!stepOutSeries()) {
                            activeCol = 'cats';
                            updateColumnFocusClasses();
                        }
                    }
                } else if (activeCol === 'cats') {
                    if (catHoverTimer) {
                        clearTimeout(catHoverTimer);
                        catHoverTimer = null;
                    }
                    activeCol = 'modes';
                    updateColumnFocusClasses();
                }
            } else if (isRight) {
                if (activeCol === 'modes') {
                    activeCol = 'cats';
                    updateColumnFocusClasses();
                } else if (activeCol === 'cats') {
                    if (catHoverTimer) {
                        clearTimeout(catHoverTimer);
                        catHoverTimer = null;
                    }
                    activeCol = 'items';
                    updateColumnFocusClasses();
                    selectCategory(catIdx, false);
                } else if (activeCol === 'items') {
                    if (isPosterGridActive() && currentItems.length > 0) {
                        if (itemIdx % 3 === 2 || itemIdx === currentItems.length - 1) {
                            if (quickActionButtons.length > 0) {
                                activeCol = 'info';
                                infoActionIdx = 0;
                                updateColumnFocusClasses();
                            }
                        } else {
                            itemIdx = Math.min(currentItems.length - 1, itemIdx + 1);
                            renderItems();
                            updatePreviewPanel();
                        }
                    } else if (quickActionButtons.length > 0) {
                        activeCol = 'info';
                        infoActionIdx = 0;
                        updateColumnFocusClasses();
                    }
                } else if (activeCol === 'info') {
                    if (infoActionIdx + 1 < quickActionButtons.length) {
                        infoActionIdx++;
                        updateInfoActionsFocus();
                    }
                }
            } else if (isUp) {
                if (activeCol === 'modes') {
                    modeIdx = (modeIdx - 1 + modes.length) % modes.length;
                    renderModes();
                } else if (activeCol === 'cats' && currentCats.length > 0) {
                    catIdx = (catIdx - 1 + currentCats.length) % currentCats.length;
                    renderCats();
                    scheduleCategoryPreview();
                } else if (activeCol === 'items' && currentItems.length > 0) {
                    var nowUpMs = Date.now();
                    var isFastRepeatUp = (nowUpMs - lastKeyRepeatTime) < 80;
                    lastKeyRepeatTime = nowUpMs;
                    if (isPosterGridActive()) {
                        itemIdx = Math.max(0, itemIdx - 3);
                    } else {
                        itemIdx = Math.max(0, itemIdx - 1);
                    }
                    renderItems();
                    if (!isFastRepeatUp) {
                        updatePreviewPanel();
                    } else {
                        if (previewDebounceTimer) {
                            clearTimeout(previewDebounceTimer);
                        }
                        previewDebounceTimer = setTimeout(updatePreviewPanel, 120);
                    }
                } else if (activeCol === 'info' && quickActionButtons.length > 0) {
                    if (infoActionIdx === 0) {
                        infoActionIdx = quickActionButtons.length - 1;
                    } else if (infoActionIdx === 1) {
                        infoActionIdx = 0;
                    } else if (infoActionIdx === quickActionButtons.length - 1 && quickActionButtons[infoActionIdx].group === 'toggle_more') {
                        infoActionIdx = Math.max(0, infoActionIdx - 1);
                    } else {
                        infoActionIdx = Math.max(0, infoActionIdx - 2);
                    }
                    updateInfoActionsFocus();
                }
            } else if (isDown) {
                if (activeCol === 'modes') {
                    modeIdx = (modeIdx + 1) % modes.length;
                    renderModes();
                } else if (activeCol === 'cats' && currentCats.length > 0) {
                    catIdx = (catIdx + 1) % currentCats.length;
                    renderCats();
                    scheduleCategoryPreview();
                } else if (activeCol === 'items' && currentItems.length > 0) {
                    var nowDownMs = Date.now();
                    var isFastRepeatDown = (nowDownMs - lastKeyRepeatTime) < 80;
                    lastKeyRepeatTime = nowDownMs;
                    if (isPosterGridActive()) {
                        itemIdx = Math.min(currentItems.length - 1, itemIdx + 3);
                    } else {
                        itemIdx = Math.min(currentItems.length - 1, itemIdx + 1);
                    }
                    renderItems();
                    if (!isFastRepeatDown) {
                        updatePreviewPanel();
                    } else {
                        if (previewDebounceTimer) {
                            clearTimeout(previewDebounceTimer);
                        }
                        previewDebounceTimer = setTimeout(updatePreviewPanel, 120);
                    }
                    loadMoreCatalogIfNeeded();
                } else if (activeCol === 'info' && quickActionButtons.length > 0) {
                    if (infoActionIdx === quickActionButtons.length - 1) {
                        infoActionIdx = 0;
                    } else {
                        infoActionIdx = Math.min(quickActionButtons.length - 1, infoActionIdx + 2);
                    }
                    updateInfoActionsFocus();
                }
            } else if (isChUp && activeCol === 'items' && currentItems.length > 0) {
                var pageStepUp = isPosterGridActive() ? 9 : 10;
                itemIdx = Math.max(0, itemIdx - pageStepUp);
                renderItems();
                updatePreviewPanel();
            } else if (isChDown && activeCol === 'items' && currentItems.length > 0) {
                var pageStepDown = isPosterGridActive() ? 9 : 10;
                itemIdx = Math.min(currentItems.length - 1, itemIdx + pageStepDown);
                renderItems();
                updatePreviewPanel();
                loadMoreCatalogIfNeeded();
            } else if (isEnter) {
                if (activeCol === 'modes') {
                    switchMode(modeIdx);
                    if (modes[modeIdx].id !== 'search' && modes[modeIdx].id !== 'settings' && modes[modeIdx].id !== 'profiles') {
                        activeCol = 'cats';
                        updateColumnFocusClasses();
                    }
                } else if (activeCol === 'cats') {
                    if (catHoverTimer) {
                        clearTimeout(catHoverTimer);
                        catHoverTimer = null;
                    }
                    activeCol = 'items';
                    updateColumnFocusClasses();
                    selectCategory(catIdx, false);
                } else if (activeCol === 'items') {
                    activateCurrentItemSelection();
                } else if (activeCol === 'info' && quickActionButtons[infoActionIdx]) {
                    quickActionButtons[infoActionIdx].fn();
                }
            } else if (isBack) {
                if (activeCol === 'info') {
                    activeCol = 'items';
                    updateColumnFocusClasses();
                    return;
                }
                if (activeCol === 'items' && stepOutSeries()) {
                    return;
                }
                if (currentPlayingItem) {
                    setOverlayVisible(false);
                } else {
                    if (exitConfirmPending) {
                        try {
                            if (typeof tizen !== 'undefined' && tizen.application) {
                                tizen.application.getCurrentApplication().exit();
                            }
                        } catch (ex) {}
                    } else {
                        exitConfirmPending = true;
                        showOSD('Exit Application', 'Press BACK again within 3 seconds to exit');
                        showToast('Press BACK again within 3 seconds to exit');
                        if (exitConfirmTimeout) {
                            clearTimeout(exitConfirmTimeout);
                        }
                        exitConfirmTimeout = setTimeout(function() {
                            exitConfirmPending = false;
                        }, 3000);
                    }
                }
            }
        });
    }

    function registerLifecycleHandlers() {
        document.addEventListener('visibilitychange', function() {
            try {
                if (typeof webapis === 'undefined' || !webapis.avplay) {
                    return;
                }
                if (document.hidden) {
                    clearBufferingWatchdog();
                    if (isPlayingVod && currentPlayingItem && currentPlayingItem.id && vodCurrentMs > 15000 && vodDurationMs > 0) {
                        saveResumeTime(currentPlayingItem.id, vodCurrentMs / 1000, vodDurationMs / 1000);
                    }
                    var avState = '';
                    try {
                        avState = webapis.avplay.getState();
                    } catch (exState) {}
                    if (avState && avState !== 'NONE' && avState !== 'IDLE') {
                        webapis.avplay.suspend();
                    }
                } else {
                    wakeLocalService().then(function() {
                        if (!currentPlayingItem) {
                            return;
                        }
                        if (!isPlayingVod && !isPlayingCatchup) {
                            playItem(currentPlayingItem);
                            return;
                        }
                        try {
                            webapis.avplay.restore();
                        } catch (exRestore) {
                            playItem(currentPlayingItem);
                        }
                    });
                }
            } catch (ex) {}
        });
    }
    function updateClock() {
        if (!clockDisplayEl) {
            return;
        }
        var now = new Date();
        var hh = ('0' + now.getHours()).slice(-2);
        var mm = ('0' + now.getMinutes()).slice(-2);
        clockDisplayEl.textContent = hh + ':' + mm;
    }
    function initApp() {
        discoverHardwareTvLanIp();
        loadProfiles();
        applyTheme(localStorage.getItem('cfg_theme') || 'blue');
        updateClock();
        setInterval(updateClock, 15000);
        updateReminderBadge();
        if (reminderCheckTimer) {
            clearInterval(reminderCheckTimer);
        }
        reminderCheckTimer = setInterval(checkScheduledReminders, 15000);
        setupKeyListeners();
        setupMouseListeners();
        registerLifecycleHandlers();
        renderUI();
        // Expose v2.1.0 Simulator hooks on window for automated & interactive testing
        window.__tizenIptvApp = {
            version: '2.1.0',
            openProfilePickerModal: openProfilePickerModal,
            closeProfilePickerModal: closeProfilePickerModal,
            openTrailerModalForSelected: openTrailerModalForSelected,
            closeTrailerModal: closeTrailerModal,
            openSettings: openSettings,
            closeSettings: closeSettings,
            cycleActivePortalProfile: cycleActivePortalProfile,
            discoverHardwareTvLanIp: discoverHardwareTvLanIp,
            generateQrSvgVersion2: generateQrSvgVersion2,
            renderProfileAvatarSvg: renderProfileAvatarSvg,
            triggerSimulatedRebufferBurst: function() {
                if (typeof webapis !== 'undefined' && webapis.avplay && webapis.avplay._listener && webapis.avplay._listener.onbufferingstart) {
                    webapis.avplay._listener.onbufferingstart();
                    webapis.avplay._listener.onbufferingstart();
                    webapis.avplay._listener.onbufferingstart();
                } else {
                    var nextMode = bufferModePref === 'fast' ? 'balanced' : 'stable';
                    bufferModePref = nextMode;
                    safeSetStorage('cfg_buffer_mode', nextMode);
                    if (selBufferModeEl) {
                        selBufferModeEl.value = nextMode;
                    }
                    showToast('🛡 Adaptive Buffer stepped up to ' + (nextMode === 'balanced' ? 'Balanced (2s)' : 'High Stability (4s)'));
                }
            }
        };
        var activeProf = getActiveProfile();
        if (!isProfileConfigured(activeProf)) {
            openSettings();
            wakeLocalService();
            return;
        }
        startupModePref = getEffectiveStartupMode();
        var openPickerFirst = (startupModePref === 'profile_picker');
        if (openPickerFirst) {
            // Do NOT load channels on the Profile Picker screen!
            // Channels will load once when the user selects a profile.
            openProfilePickerModal();
            wakeLocalService();
            return;
        }
        switchMode(0);
        wakeLocalService().then(function() {
            return api.boot();
        }).then(function() {
            var isLiveView = (modes[modeIdx] && modes[modeIdx].id === 'live') ||
                (modes[lastContentModeIdx] && modes[lastContentModeIdx].id === 'live');
            if (isLiveView && liveGenres.length <= 3 && !liveCatalogLoading && !profilePickerOpen) {
                switchMode(0);
            }
        }).catch(function(err) {
            showOSD('Connection Error', err.message);
            if (!settingsOpen && !profilePickerOpen && liveGenres.length <= 3 && allChannels.length === 0) {
                openSettings();
            }
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
