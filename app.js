/* jshint browser: true, devel: true, undef: true, unused: true, strict: true, esversion: 5 */
/* global tizen, webapis, Promise, Intl, Blob, URL, FileReader */
/*
 * SmartSTB Clone for Samsung Tizen TV & PC
 * Complete Application Controller (app.js)
 * Compatible with Tizen 4.0+ WebEngine & Desktop Browsers (ES5/ES6 safe)
 */
(function() {
    'use strict';
    var isDevPort3000 = (typeof window !== 'undefined' && window.location && window.location.port === '3000');
    var PROXY_URL = isDevPort3000 ? 'http://127.0.0.1:3000' : 'http://127.0.0.1:3001';
    var FALLBACK_PROXY_URL = isDevPort3000 ? 'http://127.0.0.1:3001' : 'http://127.0.0.1:3000';
    var SERVICE_ID = 'smartstbv2.StalkerProxy';
    var modes = [
        { id: 'live', title: 'Live TV', icon: '📺' },
        { id: 'vod', title: 'Movies (VOD)', icon: '🎬' },
        { id: 'series', title: 'TV Series', icon: '📁' },
        { id: 'search', title: 'Global Search', icon: '🔍' },
        { id: 'settings', title: 'Settings', icon: '⚙' }
    ];
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
    var vodViewMode = localStorage.getItem('cfg_vod_view') || 'grid';
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
        var vids = document.querySelectorAll('video');
        for (var v = 0; v < vids.length; v++) {
            try {
                vids[v].playbackRate = currentPlaybackSpeed;
            } catch (eVidSpd) {}
        }
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

    function rebuildGenreChannelCounts() {
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
    function processArrayInChunks(arr, chunkSize, itemFn) {
        var list = Array.isArray(arr) ? arr : [];
        var total = list.length;
        var stepSize = chunkSize || 1500;
        if (total <= stepSize) {
            var syncOut = [];
            for (var i = 0; i < total; i++) {
                var mappedSync = itemFn(list[i], i);
                if (mappedSync !== null && mappedSync !== undefined) {
                    syncOut.push(mappedSync);
                }
            }
            return Promise.resolve(syncOut);
        }
        return new Promise(function(resolve) {
            var asyncOut = [];
            var cursor = 0;
            function processSlice() {
                var end = Math.min(cursor + stepSize, total);
                for (; cursor < end; cursor++) {
                    var mapped = itemFn(list[cursor], cursor);
                    if (mapped !== null && mapped !== undefined) {
                        asyncOut.push(mapped);
                    }
                }
                if (cursor < total) {
                    setTimeout(processSlice, 0);
                } else {
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

    function decodeXtreamBase64Text(input) {
        var str = String(input || '').trim();
        if (!str || str.indexOf(' ') !== -1 || str.length < 4 || (str.length % 4) !== 0) {
            return str;
        }
        if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(str)) {
            return str;
        }
        try {
            var raw = window.atob(str);
            var hexPct = '';
            for (var i = 0; i < raw.length; i++) {
                var hex = raw.charCodeAt(i).toString(16);
                hexPct += '%' + (hex.length < 2 ? '0' : '') + hex;
            }
            var out = '';
            try {
                out = decodeURIComponent(hexPct);
            } catch (eUtf) {
                return str;
            }
            if (!out || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/.test(out)) {
                return str;
            }
            if (str.indexOf('=') === -1 && /^[A-Za-z]+$/.test(str)) {
                if (!/^[A-Za-z0-9 .,:;'?!()\-&\u00A0-\uFFFF]+$/.test(out)) {
                    return str;
                }
            }
            return out;
        } catch (ex) {
            return str;
        }
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
                if (line.charAt(0) === '#') {
                    continue;
                }
                if (!/^(https?|rtmp|rtsp|mms):\/\//i.test(line)) {
                    continue;
                }
                var streamUrl = line;
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
                            episodes: [],
                            parentSeries: grp.seriesItem,
                            isSeason: true,
                            isVod: true,
                            isSeries: true,
                            streamType: 'series'
                        };
                        grp.seasonsMap[sKey] = seasonObj;
                        grp.seriesItem.seasons.push(seasonObj);
                    }
                    var nextEpIdx = grp.seasonsMap[sKey].episodes.length + 1;
                    var resolvedEpNum = epMatch ? epNum : nextEpIdx;
                    grp.seasonsMap[sKey].episodes.push({
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
                        censored: isCensored ? 1 : 0,
                        isEpisode: true,
                        isVod: true,
                        isSeries: true,
                        streamType: 'series'
                    });
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
                    vodItems.push({
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
                    });
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
        if (msg) {
            serviceBannerEl.textContent = msg;
            serviceBannerEl.classList.add('visible');
        } else {
            serviceBannerEl.classList.remove('visible');
        }
    }
    function proxyFetch(url, opts) {
        if (typeof window !== 'undefined' && typeof window.__tizenSimFetch === 'function') {
            return window.__tizenSimFetch(url, opts);
        }
        return fetch(url, opts);
    }
    function pingProxyCandidate(baseUrl) {
        return new Promise(function(resolve) {
            var controller = (typeof window !== 'undefined' && typeof window.AbortController !== 'undefined') ? new window.AbortController() : null;
            var timer = setTimeout(function() {
                if (controller) {
                    controller.abort();
                }
                resolve(false);
            }, 450);
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
        this.m3uCatalogCache = null;
        this.activeShortEpgController = null;
    }
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
        var prof = getActiveProfile();
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
            if (!res.ok) {
                throw new Error('HTTP ' + res.status);
            }
            return res.json();
        }).catch(function(err) {
            clearTimeout(timeoutId);
            if (controller && controller.signal && controller.signal.aborted && !timedOut) {
                throw err;
            }
            return proxyFetch(targetUrl, { method: 'GET' }).then(function(res2) {
                if (!res2.ok) {
                    throw err;
                }
                return res2.json();
            });
        }).then(function(data) {
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
                            applyColumnFilters();
                            renderCats();
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
            { id: '*', title: 'All Channels', censored: false },
            { id: 'fav', title: '★ Favorites', censored: false },
            { id: 'rec', title: '⏱ History', censored: false }
        ];
        var seen = { '*': true, fav: true, rec: true };
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
            var isAdult = String(g.censored) === '1' || ADULT_RE.test(gtitle);
            base.push({ id: gid, title: gtitle, censored: isAdult });
        }
        return base;
    };
    StalkerAPI.prototype.refreshLiveInBackground = function(isRetryAttempt) {
        var self = this;
        var activeProf = getActiveProfile();
        var refreshProfId = activeProf.id;
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
            var xCatsPromise = this.xtreamRequest('get_live_categories').then(function(catsArr) {
                var list = Array.isArray(catsArr) ? catsArr : [];
                var earlySlim = [];
                for (var k = 0; k < list.length; k++) {
                    var gc = list[k];
                    if (!gc || gc.category_id === undefined) {
                        continue;
                    }
                    var gTitle = String(gc.category_name || 'Category').trim();
                    var gAdult = ADULT_RE.test(gTitle);
                    earlySlim.push({
                        id: String(gc.category_id),
                        title: gTitle,
                        censored: gAdult ? 1 : 0
                    });
                }
                if (activeProfileId === refreshProfId && earlySlim.length > 0 && liveGenres.length <= 3) {
                    liveGenres = self.getOrderedGenres(earlySlim);
                    if (getActiveContentModeId() === 'live') {
                        rawCats = liveGenres;
                        applyColumnFilters();
                        renderCats();
                        if (catsHeaderEl) {
                            catsHeaderEl.textContent = 'Categories (' + Math.max(0, currentCats.length - 3) + ')';
                        }
                    }
                }
                return list;
            }).catch(function() { return []; });
            runPromise = Promise.all([
                xCatsPromise,
                this.xtreamRequest('get_live_streams').catch(function() { return []; })
            ]).then(function(xRes) {
                var catsArr = Array.isArray(xRes[0]) ? xRes[0] : [];
                var streamsArr = Array.isArray(xRes[1]) ? xRes[1] : [];
                var slimGenres = [];
                for (var i = 0; i < catsArr.length; i++) {
                    var gc = catsArr[i];
                    if (!gc || gc.category_id === undefined) {
                        continue;
                    }
                    var gTitle = String(gc.category_name || 'Category').trim();
                    var gAdult = ADULT_RE.test(gTitle);
                    slimGenres.push({
                        id: String(gc.category_id),
                        title: gTitle,
                        censored: gAdult ? 1 : 0
                    });
                }
                return processArrayInChunks(streamsArr, 1500, function(st, j) {
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
                }).then(function(slimChannels) {
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
                                if (slimChannels.length <= 12000) {
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
        } else {
            var genresPromise = this.request({ type: 'itv', action: 'get_genres' }).then(function(gRes) {
                var genresRaw = Array.isArray(gRes) ? gRes : (gRes && gRes.data ? gRes.data : []);
                var earlySlim = [];
                for (var k = 0; k < genresRaw.length; k++) {
                    var g = genresRaw[k];
                    if (g && g.id !== undefined && String(g.id) !== '*') {
                        var title = String(g.title || g.name || 'Category').trim();
                        if (!title) {
                            continue;
                        }
                        var isAdult = String(g.censored || '0') === '1' || ADULT_RE.test(title);
                        earlySlim.push({
                            id: String(g.id),
                            title: title,
                            censored: isAdult ? 1 : 0
                        });
                    }
                }
                if (activeProfileId === refreshProfId && earlySlim.length > 0 && liveGenres.length <= 3) {
                    liveGenres = self.getOrderedGenres(earlySlim);
                    if (getActiveContentModeId() === 'live') {
                        rawCats = liveGenres;
                        applyColumnFilters();
                        renderCats();
                        if (catsHeaderEl) {
                            catsHeaderEl.textContent = 'Categories (' + Math.max(0, currentCats.length - 3) + ')';
                        }
                    }
                }
                return gRes;
            }).catch(function() {
                return [];
            });
            var channelsPromise = this.request({ type: 'itv', action: 'get_all_channels' }).catch(function() {
                return [];
            });
            runPromise = Promise.all([genresPromise, channelsPromise]).then(function(results) {
                var genresRaw = Array.isArray(results[0]) ? results[0] : (results[0] && results[0].data ? results[0].data : []);
                var chRes = results[1] || {};
                var chData = Array.isArray(chRes.data) ? chRes.data : (Array.isArray(chRes) ? chRes : []);
                var slimGenres = [];
                for (var i = 0; i < genresRaw.length; i++) {
                    var g = genresRaw[i];
                    if (g && g.id !== undefined && String(g.id) !== '*') {
                        var title = String(g.title || g.name || 'Category').trim();
                        if (!title) {
                            continue;
                        }
                        var isAdult = String(g.censored || '0') === '1' || ADULT_RE.test(title);
                        slimGenres.push({
                            id: String(g.id),
                            title: title,
                            censored: isAdult ? 1 : 0
                        });
                    }
                }
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
                }).then(function(slimChannels) {
                    chData = null;
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
                                if (slimChannels.length <= 12000) {
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
        if (this.getProviderType() !== 'stalker') {
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
        if (this.getProviderType() === 'm3u') {
            return this.ensureM3uCatalogLoaded(false).then(function(cat) {
                return cat.vodCategories;
            });
        }
        if (this.getProviderType() === 'xtream') {
            return this.xtreamRequest('get_vod_categories').then(function(list) {
                var arr = Array.isArray(list) ? list : [];
                var out = [
                    { id: '*', title: 'All Movies', censored: false },
                    { id: 'new', title: '🆕 Recently Added', censored: false },
                    { id: 'cont', title: '▶ Continue Watching', censored: false },
                    { id: 'fav', title: '★ Favorites', censored: false },
                    { id: 'rec', title: '⏱ History', censored: false }
                ];
                for (var i = 0; i < arr.length; i++) {
                    var c = arr[i];
                    if (!c || c.category_id === undefined) {
                        continue;
                    }
                    var title = String(c.category_name || 'Movies').trim();
                    if (!title) {
                        continue;
                    }
                    var isAdult = ADULT_RE.test(title);
                    out.push({ id: String(c.category_id), title: title, censored: isAdult });
                }
                return out;
            });
        }
        if (!isRetryAttempt && this.vodCategoriesPromise) {
            return this.vodCategoriesPromise;
        }
        var vEpoch = this.sessionEpoch || 0;
        var p = this.request({ type: 'vod', action: 'get_categories' }).then(function(res) {
            var list = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
            var out = [
                { id: '*', title: 'All Movies', censored: false },
                { id: 'new', title: '🆕 Recently Added', censored: false },
                { id: 'cont', title: '▶ Continue Watching', censored: false },
                { id: 'fav', title: '★ Favorites', censored: false },
                { id: 'rec', title: '⏱ History', censored: false }
            ];
            for (var i = 0; i < list.length; i++) {
                var c = list[i];
                if (!c || String(c.id) === '*') {
                    continue;
                }
                var title = String(c.title || c.name || 'Movies').trim();
                if (!title) {
                    continue;
                }
                var isAdult = String(c.censored) === '1' || ADULT_RE.test(title);
                out.push({ id: String(c.id), title: title, censored: isAdult });
            }
            if (out.length <= 5 && !isRetryAttempt) {
                self.token = '';
                return self.ensureAuthenticatedSession().then(function() {
                    return self.fetchVodCategories(true);
                });
            }
            return out;
        }).catch(function(err) {
            if (!isRetryAttempt) {
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
            if (this.xtreamVodStreamsCache && this.xtreamVodStreamsCache.profileId === activeProf.id) {
                return Promise.resolve(filterAndPaginateLocalList(this.xtreamVodStreamsCache.items, categoryId, page, searchQuery, sortBy));
            }
            if (!this.xtreamVodPromise) {
                var xAuthVod = {
                    base: normalizeXtreamServerUrl(activeProf.xtreamUrl || ''),
                    user: encodeURIComponent(String(activeProf.xtreamUser || '').trim()),
                    pass: encodeURIComponent(String(activeProf.xtreamPass || '').trim())
                };
                var xVodEpoch = this.sessionEpoch || 0;
                this.xtreamVodPromise = this.xtreamRequest('get_vod_streams').then(function(rows) {
                    var arr = Array.isArray(rows) ? rows : [];
                    return processArrayInChunks(arr, 1500, function(m) {
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
                            genreId: String(m.category_id || '*'),
                            censored: (String(m.is_adult) === '1' || ADULT_RE.test(mName)) ? 1 : 0,
                            isVod: true,
                            isSeries: false
                        };
                    });
                }).then(function(items) {
                    if (self.sessionEpoch === xVodEpoch) {
                        self.xtreamVodPromise = null;
                        self.xtreamVodStreamsCache = { profileId: activeProf.id, items: items };
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
        if (this.getProviderType() === 'm3u') {
            return this.ensureM3uCatalogLoaded(false).then(function(cat) {
                return cat.seriesCategories;
            });
        }
        if (this.getProviderType() === 'xtream') {
            return this.xtreamRequest('get_series_categories').then(function(list) {
                var arr = Array.isArray(list) ? list : [];
                var out = [
                    { id: '*', title: 'All Series', censored: false },
                    { id: 'new', title: '🆕 Recently Added', censored: false },
                    { id: 'cont', title: '▶ Continue Watching', censored: false },
                    { id: 'fav', title: '★ Favorites', censored: false },
                    { id: 'rec', title: '⏱ History', censored: false }
                ];
                for (var i = 0; i < arr.length; i++) {
                    var c = arr[i];
                    if (!c || c.category_id === undefined) {
                        continue;
                    }
                    var title = String(c.category_name || 'Series').trim();
                    if (!title) {
                        continue;
                    }
                    out.push({
                        id: String(c.category_id),
                        title: title,
                        censored: ADULT_RE.test(title)
                    });
                }
                return out;
            });
        }
        if (!isRetryAttempt && this.seriesCategoriesPromise) {
            return this.seriesCategoriesPromise;
        }
        var sEpoch = this.sessionEpoch || 0;
        function buildSeriesCategoryOut(list) {
            var arr = Array.isArray(list) ? list : (list && Array.isArray(list.data) ? list.data : []);
            var out = [
                { id: '*', title: 'All Series', censored: false },
                { id: 'new', title: '🆕 Recently Added', censored: false },
                { id: 'cont', title: '▶ Continue Watching', censored: false },
                { id: 'fav', title: '★ Favorites', censored: false },
                { id: 'rec', title: '⏱ History', censored: false }
            ];
            for (var i = 0; i < arr.length; i++) {
                var c = arr[i];
                if (!c || String(c.id) === '*') {
                    continue;
                }
                var title = String(c.title || c.name || 'Series').trim();
                if (!title) {
                    continue;
                }
                out.push({
                    id: String(c.id),
                    title: title,
                    censored: String(c.censored) === '1' || ADULT_RE.test(title)
                });
            }
            return out;
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
            if (!isRetryAttempt) {
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
            if (this.xtreamSeriesCache && this.xtreamSeriesCache.profileId === activeProf.id) {
                return Promise.resolve(filterAndPaginateLocalList(this.xtreamSeriesCache.items, categoryId, page, searchQuery, sortBy));
            }
            if (!this.xtreamSeriesPromise) {
                var xSerEpoch = this.sessionEpoch || 0;
                this.xtreamSeriesPromise = this.xtreamRequest('get_series').then(function(rows) {
                    var arr = Array.isArray(rows) ? rows : [];
                    return processArrayInChunks(arr, 1500, function(s) {
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
                            genreId: String(s.category_id || '*'),
                            censored: (String(s.is_adult) === '1' || ADULT_RE.test(serName)) ? 1 : 0,
                            isVod: true,
                            isSeries: true,
                            streamType: 'series'
                        };
                    });
                }).then(function(items) {
                    if (self.sessionEpoch === xSerEpoch) {
                        self.xtreamSeriesPromise = null;
                        self.xtreamSeriesCache = { profileId: activeProf.id, items: items };
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
                            desc: String((ep.info && ep.info.plot) || seriesItem.desc || ''),
                            poster: String((ep.info && ep.info.movie_image) || seriesItem.poster || ''),
                            seriesNum: epNum,
                            seasonId: String(sKey),
                            seriesId: String(seriesItem.id),
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
    function extractStreamUrl(rawCmd, portalBase) {
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
            candidate = candidate.split('|')[0];
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
        var directUrl = extractStreamUrl(rawItemCmd, portalBase);

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
        var catPool = item.isSeries ? seriesCats : (item.isVod ? vodCats : liveGenres);
        var result = false;
        if (gId && gId !== '*' && catPool) {
            for (var i = 0; i < catPool.length; i++) {
                if (String(catPool[i].id) === gId) {
                    if (Boolean(catPool[i].censored) || ADULT_RE.test(String(catPool[i].title || ''))) {
                        result = true;
                    }
                    break;
                }
            }
        }
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
        safeSetStorage(getProfileScopedKey('hidden_items_' + mId), JSON.stringify(hidden));
        applyColumnFilters();
        if (itemsListEl) {
            itemsListEl._forceRebuild = true;
        }
        renderUI();
    }
    function toggleShowHiddenMode() {
        showHiddenEntries = !showHiddenEntries;
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
                sleepTimerMinutes = 0;
                currentPlayingItem = null;
                stopPlayback();
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
        if (currentSec / durationSec > 0.92) {
            delete map[key];
            markItemWatched(itemId);
        } else if (currentSec < 15) {
            if (!map[key]) {
                return;
            }
            delete map[key];
        } else {
            var newPos = Math.floor(currentSec);
            var existing = map[key];
            if (existing && Math.abs(existing.pos - newPos) < 4) {
                return;
            }
            map[key] = { pos: newPos, dur: Math.floor(durationSec), ts: Date.now() };
        }
        vodResumeCache = map;
        if (itemsListEl) {
            itemsListEl._forceRebuild = true;
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

    function startBufferingWatchdog(item, streamUrl, activeSession) {
        clearBufferingWatchdog();
        if (streamUrl && String(streamUrl).indexOf('/stream?url=') !== -1) {
            bufferingDiagPollTimer = setInterval(function() {
                pollStreamDiagDuringBuffer(item, streamUrl, activeSession);
            }, 1200);
        }
        var isLiveFastSwitch = item && !item.isVod && !item.isEpisode && !item.isCatchup;
        var watchdogMs = isLiveFastSwitch ? (retryCount === 0 ? 7500 : 8500) : 35000;
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

    function stopPlayback() {
        isPlaybackHealthy = false;
        document.body.classList.remove('playing-live');
        currentPlaybackSpeed = 1;
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
        try {
            var vids = document.getElementsByTagName('video');
            for (var v = 0; v < vids.length; v++) {
                if (vids[v] && vids[v].playbackRate !== 1) {
                    vids[v].playbackRate = 1;
                }
            }
        } catch (eVidRate) {}
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

    function playUrl(streamUrl, item, sessionToken) {
        if (sessionToken !== undefined && sessionToken !== playSessionId) {
            return;
        }
        stopPlayback();
        var isProxyStreamUrl = String(streamUrl || '').indexOf('/stream?url=') !== -1;
        if (!streamUrl || (!isProxyStreamUrl && isLocalhostOrInvalidUrl(streamUrl))) {
            hasActivePlaybackError = true;
            showOSD(formatOsdTitle(item), 'Invalid Stream URL');
            return;
        }
        var activeSession = sessionToken || playSessionId;
        var hasSyncedTracksOnBuffer = false;
        try {
            if (typeof webapis === 'undefined' || !webapis.avplay) {
                isPlaybackHealthy = true;
                hasActivePlaybackError = false;
                if (isPlaybackHealthy) {
                    document.body.classList.add('playing-live');
                }
                showOSD(formatOsdTitle(item), 'SIMULATED PLAY');
                return;
            }
            webapis.avplay.open(streamUrl);
            try {
                var streamUserAgent = (isPlayingVod || api.getProviderType() !== 'stalker') ?
                    'VLC/3.0.20 LibVLC/3.0.20' :
                    'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';
                webapis.avplay.setStreamingProperty('USER_AGENT', streamUserAgent);
            } catch (eUa) {}
            try {
                if (webapis.productinfo && typeof webapis.productinfo.isUdPanelSupported === 'function' && webapis.productinfo.isUdPanelSupported()) {
                    webapis.avplay.setStreamingProperty('SET_MODE_4K', 'TRUE');
                }
            } catch (e4k) {}
            try {
                if (!isPlayingVod && !isPlayingCatchup) {
                    webapis.avplay.setStreamingProperty('IS_LIVE', 'TRUE');
                } else {
                    webapis.avplay.setStreamingProperty('IS_LIVE', 'FALSE');
                }
            } catch (eLive) {}
            applyAvPlayDisplayRect();
            try {
                webapis.avplay.setDisplayMethod(currentAspect);
            } catch (eAspect) {}
            try {
                var initBufSec = (isPlayingVod || isPlayingCatchup) ? 3 : 1;
                var resumeBufSec = (isPlayingVod || isPlayingCatchup) ? 6 : 2;
                if (bufferModePref === 'balanced') {
                    initBufSec = (isPlayingVod || isPlayingCatchup) ? 4 : 2;
                    resumeBufSec = (isPlayingVod || isPlayingCatchup) ? 8 : 4;
                } else if (bufferModePref === 'stable') {
                    initBufSec = (isPlayingVod || isPlayingCatchup) ? 6 : 4;
                    resumeBufSec = (isPlayingVod || isPlayingCatchup) ? 12 : 6;
                }
                webapis.avplay.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', initBufSec);
                webapis.avplay.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', resumeBufSec);
                try {
                    webapis.avplay.setTimeoutForBuffering(25);
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
                    if (!uiVisible) {
                        showOSD(formatOsdTitle(item), 'BUFFERING...');
                    }
                },
                onbufferingprogress: function(percent) {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    if (!uiVisible && osdStatus) {
                        osdStatus.textContent = 'BUFFERING ' + percent + '%';
                    }
                },
                onbufferingcomplete: function() {
                    if (activeSession !== playSessionId) {
                        return;
                    }
                    clearBufferingWatchdog();
                    isPlaybackHealthy = true;
                    hasActivePlaybackError = false;
                    if (isPlaybackHealthy) {
                        document.body.classList.add('playing-live');
                    }
                    if (!hasSyncedTracksOnBuffer) {
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
                    isPlaybackHealthy = true;
                    hasActivePlaybackError = false;
                    if (isPlaybackHealthy && !document.body.classList.contains('playing-live')) {
                        document.body.classList.add('playing-live');
                    }
                    if (playbackStartedAt > 0 && (Date.now() - playbackStartedAt) > 10000 && retryCount > 0) {
                        retryCount = 0;
                    }
                    if (!hasSyncedTracksOnBuffer) {
                        hasSyncedTracksOnBuffer = true;
                        refreshTrackLists();
                        syncInitialActiveTracks();
                        applySavedTrackPrefsForCurrentItem();
                        updateOsdStreamTelemetry();
                    }
                    vodCurrentMs = Number(currentTimeMs) || 0;
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
                            var pct = Math.min(100, Math.max(0, (vodCurrentMs / vodDurationMs) * 100));
                            if (vodProgressBar) {
                                vodProgressBar.style.width = pct + '%';
                            }
                            var durSec = Math.floor(vodDurationMs / 1000);
                            if (vodTimeDurEl && vodTimeLabel) {
                                vodTimeLabel.textContent = formatTimeHMS(curSec);
                                vodTimeDurEl.textContent = formatTimeHMS(durSec);
                            } else if (vodTimeLabel) {
                                vodTimeLabel.textContent = formatTimeHMS(curSec) + ' / ' + formatTimeHMS(durSec);
                            }
                            if (isPlayingVod && Math.abs(curSec - lastSavedSec) >= 5) {
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
                        try {
                            webapis.avplay.seekTo(resume.pos * 1000);
                            showOSD(formatOsdTitle(item), 'Resumed at ' + formatTimeHMS(resume.pos));
                        } catch (ex2) {}
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
        item._cmdIdx = 0;
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

        api.resolveStream(item, false).then(function(url) {
            if (mySession !== playSessionId) {
                return;
            }
            var cleanUrl = String(url || '').replace(/^(?:ffmpeg|ffrt\d*|auto|solution)\s+/i, '').trim();
            playUrl(cleanUrl, item, mySession);
        }).catch(function(err) {
            if (mySession !== playSessionId) {
                return;
            }
            hasActivePlaybackError = true;
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
            var info = typeof trackObj.extra_info === 'object' ? trackObj.extra_info : JSON.parse(trackObj.extra_info);
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
            if (currentPlayingItem && Array.isArray(currentPlayingItem.cmds) && currentPlayingItem.cmds.length > 1) {
                currentPlayingItem._cmdIdx = ((currentPlayingItem._cmdIdx || 0) + 1) % currentPlayingItem.cmds.length;
                var nextLinkNum = currentPlayingItem._cmdIdx + 1;
                showToast('🔄 Switching to Server Link ' + nextLinkNum + '/' + currentPlayingItem.cmds.length);
                var linkSession = ++playSessionId;
                stopPlayback();
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

    function getLiveZapList() {
        var isLiveModeActive = modes[modeIdx] && modes[modeIdx].id === 'live' &&
            currentItems.length > 0 && currentItems[0] && !currentItems[0].isVod && !currentItems[0].isSeries && !currentItems[0].isSeason;
        if (isLiveModeActive) {
            return currentItems;
        }
        if (currentPlayingItem && currentPlayingItem.genreId && genreChannelsMap[String(currentPlayingItem.genreId)] &&
            genreChannelsMap[String(currentPlayingItem.genreId)].length > 0) {
            return genreChannelsMap[String(currentPlayingItem.genreId)];
        }
        return allChannels;
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
    function toggleEpgModalViewMode() {
        if (!epgModalOpen) {
            return;
        }
        epgViewMode = (epgViewMode === 'grid') ? 'list' : 'grid';
        syncEpgModalViewModeUI();
        if (epgViewMode === 'grid') {
            var listSource = (getActiveContentModeId() === 'live' && currentItems.length > 0) ? currentItems : allChannels;
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
            var listSource = (getActiveContentModeId() === 'live' && currentItems.length > 0) ? currentItems : allChannels;
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
        var pool = (getActiveContentModeId() === 'live' && currentItems.length > 0) ? currentItems : allChannels;
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
        if (epgModalList) {
            epgModalList._forceRebuild = true;
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
            thumb.style.opacity = '0';
            return;
        }
        var thumbHeightPct = Math.max(8, Math.min(82, (winCount / totalLen) * 85));
        var maxScrollStart = Math.max(1, totalLen - winCount);
        var thumbTopPct = 8 + Math.min(84 - thumbHeightPct, (startIdx / maxScrollStart) * (84 - thumbHeightPct));
        thumb.style.top = thumbTopPct.toFixed(1) + '%';
        thumb.style.height = thumbHeightPct.toFixed(1) + '%';
        thumb.style.opacity = '0.65';
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
            var isAdult = Boolean(entry.censored) || ADULT_RE.test(String(entry.title || ''));
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
        var firstId = list[start] ? (list[start].id || list[start].catId || list[start].title || list[start].name) : '';
        var lastId = list[end - 1] ? (list[end - 1].id || list[end - 1].catId || list[end - 1].title || list[end - 1].name) : '';
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
                container.removeChild(container.firstElementChild);
                container.appendChild(createListItemRow(container, list[end - 1], end - 1, selectedIdx, labelFn));
            } else if (start === container._lastStart - 1 && container.lastElementChild) {
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
        container.innerHTML = '';
        var frag = document.createDocumentFragment();
        for (var i = start; i < end; i++) {
            frag.appendChild(createListItemRow(container, list[i], i, selectedIdx, labelFn));
        }
        container.appendChild(frag);
    }

    function applyColumnFilters() {
        var curModeId = getActiveContentModeId();
        var pinnedLookup = getPinnedCatMap(curModeId);
        var hiddenCatIds = getHiddenCatIds(curModeId);
        var hiddenCatLookup = getHiddenCatMap(curModeId);
        var hiddenItemIds = getHiddenItemIds(curModeId);
        var hiddenItemLookup = getHiddenItemMap(curModeId);
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
        var cFilter = (catFilterText || '').toLowerCase().trim();
        if (cFilter) {
            currentCats = orderedRawCats.filter(function(c) {
                return getCatLowerTitle(c).indexOf(cFilter) !== -1;
            });
        } else {
            currentCats = orderedRawCats;
        }
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
        var iFilter = (itemFilterText || '').toLowerCase().trim();
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
    function createPosterCardNode(entry, index, selectedIdx) {
        var card = document.createElement('div');
        var isCardPlaying = isCurrentlyPlayingEntry(entry);
        card.className = 'poster-card' + (index === selectedIdx ? ' selected' : '') + (isCardPlaying ? ' playing' : '');
        card._entryRef = entry || null;
        card.setAttribute('data-index', String(index));
        card.onclick = function(e) {
            e.stopPropagation();
            userInteractedSinceBoot = true;
            itemIdx = index;
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
                if (!imgWrap.querySelector('.poster-card-monogram')) {
                    var mono = document.createElement('div');
                    mono.className = 'poster-card-monogram';
                    mono.textContent = (entry.name || 'VOD').slice(0, 2).toUpperCase();
                    imgWrap.appendChild(mono);
                }
            };
            imgWrap.appendChild(img);
        } else {
            var mono = document.createElement('div');
            mono.className = 'poster-card-monogram';
            mono.textContent = (entry.name || 'VOD').slice(0, 2).toUpperCase();
            imgWrap.appendChild(mono);
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
        var sameWindow = !container._forceRebuild &&
            container._gridRef === list &&
            container._gridLen === list.length &&
            container._gridStart === start &&
            container._gridEnd === end &&
            container._gridFirstId === firstId &&
            container._gridLastId === lastId &&
            children && children.length === (end - start) &&
            children[0] && children[0].classList && children[0].classList.contains('poster-card');

        if (sameWindow) {
            for (var c = 0; c < children.length; c++) {
                var actualIdx = start + c;
                if (actualIdx === selectedIdx) {
                    children[c].classList.add('selected');
                } else {
                    children[c].classList.remove('selected');
                }
                if (isCurrentlyPlayingEntry(children[c]._entryRef)) {
                    children[c].classList.add('playing');
                } else {
                    children[c].classList.remove('playing');
                }
            }
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
        for (var i = 0; i < quickActionButtons.length; i++) {
            var pill = quickActionButtons[i].el;
            if (activeCol === 'info' && i === infoActionIdx) {
                pill.classList.add('focused');
            } else {
                pill.classList.remove('focused');
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
            { label: '★ Favorite', group: 'primary', fn: function() {
                if (currentItems[itemIdx]) {
                    toggleFavorite(currentItems[itemIdx]);
                }
            } },
            { label: '⚡ Switch Portal', group: 'portal_switch', fn: function() { cycleActivePortalProfile(); } },
            { label: '⬆ Fav Up', group: 'fav_context', fn: function() { moveFavoriteItem(-1); } },
            { label: '⬇ Fav Down', group: 'fav_context', fn: function() { moveFavoriteItem(1); } },
            { label: '📅 EPG Guide', group: 'live_primary', fn: function() { openEpgModal(currentItems[itemIdx]); } },
            { label: '⏰ Remind Next', group: 'live_primary', fn: function() { scheduleNextProgramReminderForSelectedChannel(); } },
            { label: '🔊 Audio / Subs', group: 'primary', fn: function() { openTracksModal('audio'); } },
            { label: '▦ Grid / List View', group: 'vod_primary', fn: function() {
                vodViewMode = (vodViewMode === 'grid') ? 'list' : 'grid';
                safeSetStorage('cfg_vod_view', vodViewMode);
                if (itemsListEl) {
                    itemsListEl._forceRebuild = true;
                }
                showToast('View: ' + (vodViewMode === 'grid' ? '▦ 3-Column Grid' : '☰ List'));
                renderItems();
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
                moreToolsExpanded = !moreToolsExpanded;
                lastQuickActionSig = '';
                syncQuickActionVisibility();
                infoActionIdx = Math.max(0, quickActionButtons.length - 1);
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

    function updatePreviewPanel() {
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
        var item = currentItems[itemIdx];
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
            if (/\b(4K|UHD|2160p)\b/i.test(item.name || '')) {
                vodPills.push({ text: '4K UHD', cls: 'quality' });
            } else if (/\b(FHD|1080p)\b/i.test(item.name || '')) {
                vodPills.push({ text: '1080p', cls: 'quality' });
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
                previewDescEl.textContent = item.desc || 'No synopsis available.';
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

    function tryAutoResumeLastLiveChannel() {
        if (hasAutoResumedOnBoot) {
            return false;
        }
        hasAutoResumedOnBoot = true;
        if (userInteractedSinceBoot || currentPlayingItem) {
            return false;
        }
        if (startupModePref === 'guide') {
            return false;
        }
        if (startupModePref === 'favorites') {
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
        if (warmPreloadTimer) {
            clearTimeout(warmPreloadTimer);
        }
        var reqProfId = activeProfileId;
        var reqEpoch = api.sessionEpoch || 0;
        warmPreloadTimer = setTimeout(function() {
            warmPreloadTimer = null;
            if (activeProfileId !== reqProfId || (api.sessionEpoch || 0) !== reqEpoch) {
                return;
            }
            if (vodCats.length <= 5) {
                api.fetchVodCategories(false).then(function(cats) {
                    if (activeProfileId === reqProfId && (api.sessionEpoch || 0) === reqEpoch && Array.isArray(cats) && cats.length > 5) {
                        vodCats = cats;
                    }
                }).catch(function() {});
            }
            if (seriesCats.length <= 5) {
                api.fetchSeriesCategories(false).then(function(cats) {
                    if (activeProfileId === reqProfId && (api.sessionEpoch || 0) === reqEpoch && Array.isArray(cats) && cats.length > 5) {
                        seriesCats = cats;
                    }
                }).catch(function() {});
            }
        }, 1800);
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
        if (mode.id === 'settings') {
            openSettings();
            return;
        }
        if (settingsOpen) {
            closeSettings();
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
        var reqProfId = activeProfileId;
        if (catsHeaderEl) {
            catsHeaderEl.textContent = 'Categories';
        }
        if (itemsHeaderEl) {
            itemsHeaderEl.textContent = mode.title;
        }

        if (mode.id === 'live') {
            if (liveGenres.length > 3 && allChannels.length > 0) {
                liveCatalogLoading = false;
                rebuildGenreChannelCounts();
                rawCats = liveGenres;
                applyColumnFilters();
                if (!tryAutoResumeLastLiveChannel()) {
                    selectCategory(0, true);
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
            return epEntry;
        }
        var epNum = (epEntry !== undefined && epEntry !== null) ? epEntry : (idx + 1);
        return {
            id: parentId + '_s' + sId + '_e' + epNum,
            name: 'Episode ' + epNum,
            cmd: seasonObj.cmd,
            desc: seasonObj.desc,
            poster: seasonObj.poster,
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
        rawItems = prev.rawItems;
        itemIdx = prev.itemIdx;
        itemFilterText = prev.itemFilterText || '';
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

    function stopLanRemoteSetupPolling() {
        if (lanSetupPollTimer) {
            clearInterval(lanSetupPollTimer);
            lanSetupPollTimer = null;
        }
    }
    function startLanRemoteSetupPolling() {
        stopLanRemoteSetupPolling();
        proxyFetch(api.proxyUrl + '/lan-info', { method: 'GET' }).then(function(r) {
            return r.json();
        }).then(function(info) {
            var lanUrl = info && (info.url || info.setupUrl);
            if (lanSetupUrlEl && lanUrl) {
                lanSetupUrlEl.textContent = lanUrl;
            }
        }).catch(function() {});

        lanSetupPollTimer = setInterval(function() {
            if (!settingsOpen) {
                stopLanRemoteSetupPolling();
                return;
            }
            proxyFetch(api.proxyUrl + '/remote-setup?consume=1', { method: 'GET' }).then(function(r) {
                return r.json();
            }).then(function(data) {
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
        modeIdx = 4;
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
            selStartupModeEl.value = startupModePref || localStorage.getItem('cfg_startup_mode') || 'last_channel';
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
        rebuildGenreChannelCounts();
    }

    function activateProfileAndConnect(prof) {
        if (!prof) {
            return;
        }
        var targetModeIdx = (modes[modeIdx] && modes[modeIdx].id !== 'settings' && modes[modeIdx].id !== 'search') ? modeIdx : (lastContentModeIdx || 0);
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
        switchMode(targetModeIdx);
        wakeLocalService().then(function() {
            if (activeProfileId !== switchProfId) {
                return;
            }
            return api.boot();
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
            startupModePref = selStartupModeEl.value;
            safeSetStorage('cfg_startup_mode', startupModePref);
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
        if (inpPinEl && inpPinEl.value.trim().length === 4) {
            var newPin = inpPinEl.value.trim();
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
        for (var i = 0; i < list.length; i++) {
            var c = list[i];
            if (!c || c.id === '*' || c.id === 'new' || c.id === 'cont' || c.id === 'fav' || c.id === 'rec') {
                continue;
            }
            var title = String(c.title || '');
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
            if (liveMatches.length < 30 && (getItemLowerName(ch).indexOf(q) !== -1 || String(ch.num || '') === q)) {
                liveMatches.push(ch);
            }
            if (hasAnyCachedEpg && epgProgMatches.length < 15 && (window._parentalUnlocked || !isAdultContentItem(ch))) {
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
            var vodMatches = (res[0] || []).slice(0, 20);
            var seriesMatches = (res[1] || []).slice(0, 20);
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

        document.addEventListener('keydown', function(e) {
            userInteractedSinceBoot = true;
            var code = e.keyCode;
            var key = e.key || '';
            var isInputFocused = Boolean(document.activeElement && document.activeElement.tagName === 'INPUT');
            var isUp = code === 38 || key === 'ArrowUp';
            var isDown = code === 40 || key === 'ArrowDown';
            var isLeft = code === 37 || key === 'ArrowLeft';
            var isRight = code === 39 || key === 'ArrowRight';
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
            var isPlayPause = code === 10252 || key === 'MediaPlayPause' || key === ' ';
            var isPlay = code === 415 || key === 'MediaPlay';
            var isPause = code === 19 || key === 'MediaPause';
            var isStop = code === 413 || key === 'MediaStop';
            var isRewind = code === 412 || key === 'MediaRewind';
            var isFastForward = code === 417 || key === 'MediaFastForward';

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
                        modeIdx = 4;
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
                            if (modes[modeIdx] && modes[modeIdx].id !== 'search' && modes[modeIdx].id !== 'settings') {
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
                            modeIdx = 4;
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
                        var startModes = ['last_channel', 'guide', 'favorites'];
                        var curSM = startModes.indexOf(selStartupModeEl.value);
                        selStartupModeEl.value = startModes[(curSM + 1) % startModes.length];
                        startupModePref = selStartupModeEl.value;
                        safeSetStorage('cfg_startup_mode', startupModePref);
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
                    infoActionIdx = Math.max(0, infoActionIdx - 2);
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
                    infoActionIdx = Math.min(quickActionButtons.length - 1, infoActionIdx + 2);
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
                    if (modes[modeIdx].id !== 'search' && modes[modeIdx].id !== 'settings') {
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
        var activeProf = getActiveProfile();
        if (!isProfileConfigured(activeProf)) {
            openSettings();
            wakeLocalService();
            return;
        }
        switchMode(0);
        wakeLocalService().then(function() {
            return api.boot();
        }).then(function() {
            var isLiveView = (modes[modeIdx] && modes[modeIdx].id === 'live') ||
                (modes[lastContentModeIdx] && modes[lastContentModeIdx].id === 'live');
            if (isLiveView && liveGenres.length <= 3 && !liveCatalogLoading) {
                switchMode(0);
            }
        }).catch(function(err) {
            showOSD('Connection Error', err.message);
            if (!settingsOpen && liveGenres.length <= 3 && allChannels.length === 0) {
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
