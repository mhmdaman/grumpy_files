// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Interactive Cleanup Candidates Controller with Multi-Selection
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // State
  let cleanupData = null;
  let totalReclaimedBytes = 0;
  let selectedCategory = 'ALL';
  let selectedRecommendation = 'ALL';
  let searchQuery = '';
  let pendingTrashCandidate = null;
  const selectedPaths = new Set();

  // DOM Elements
  const scannedPathDisplay = document.getElementById('scanned-path-display');
  const revealFolderBtn = document.getElementById('reveal-folder-btn');
  const refreshBtn = document.getElementById('refresh-btn');

  const statTotalCandidates = document.getElementById('stat-total-candidates');
  const statDuplicateWasted = document.getElementById('stat-duplicate-wasted');
  const statPotentialCleanup = document.getElementById('stat-potential-cleanup');
  const statReviewCount = document.getElementById('stat-review-count');
  const statReclaimedSpace = document.getElementById('stat-reclaimed-space');

  const searchInput = document.getElementById('search-input');
  const categoryTabs = document.getElementById('category-tabs');
  const recommendationSelect = document.getElementById('recommendation-select');
  const candidatesContainer = document.getElementById('candidates-container');

  const countAll = document.getElementById('count-all');
  const countDup = document.getElementById('count-dup');
  const countInst = document.getElementById('count-inst');
  const countLarge = document.getElementById('count-large');
  const countOld = document.getElementById('count-old');
  const countEmpty = document.getElementById('count-empty');

  // Multi-selection elements
  const masterSelectAllCb = document.getElementById('master-select-all-cb');
  const masterSelectLabel = document.getElementById('master-select-label');
  const selectAllBtn = document.getElementById('select-all-btn');
  const selectDupBtn = document.getElementById('select-dup-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');

  const batchActionBar = document.getElementById('batch-action-bar');
  const batchSelectedCount = document.getElementById('batch-selected-count');
  const batchSelectedSize = document.getElementById('batch-selected-size');
  const batchCancelBtn = document.getElementById('batch-cancel-btn');
  const batchTrashBtn = document.getElementById('batch-trash-btn');

  // Single Modal
  const confirmModal = document.getElementById('confirm-modal');
  const modalFileName = document.getElementById('modal-file-name');
  const modalFilePath = document.getElementById('modal-file-path');
  const modalFileSize = document.getElementById('modal-file-size');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');

  // Batch Modal
  const batchConfirmModal = document.getElementById('batch-confirm-modal');
  const batchModalTitle = document.getElementById('batch-modal-title');
  const batchModalSubtitle = document.getElementById('batch-modal-subtitle');
  const batchModalItemsList = document.getElementById('batch-modal-items-list');
  const batchModalCancelBtn = document.getElementById('batch-modal-cancel-btn');
  const batchModalConfirmBtn = document.getElementById('batch-modal-confirm-btn');

  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');

  // Format bytes helper
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Toast Helper
  let toastTimeout = null;
  function showToast(msg) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastText.textContent = msg;
    toast.classList.remove('hidden');
    toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  }

  // Load initial data with automatic retry if IPC is initializing
  async function loadData(retryCount = 0) {
    if (window.grumpyDuckApi?.getCleanupData) {
      try {
        const res = await window.grumpyDuckApi.getCleanupData();
        if (res && res.cleanupData) {
          cleanupData = res.cleanupData;
          totalReclaimedBytes = res.totalReclaimedBytes || 0;
          renderAll();
        } else if (retryCount < 4) {
          setTimeout(() => loadData(retryCount + 1), 120 * (retryCount + 1));
        } else {
          renderAll();
        }
      } catch (err) {
        console.error('Failed to load cleanup data:', err);
      }
    }
  }

  // Listen for real-time updates from IPC
  if (window.grumpyDuckApi?.onCleanupDataUpdated) {
    window.grumpyDuckApi.onCleanupDataUpdated((res) => {
      if (res) {
        cleanupData = res.cleanupData;
        totalReclaimedBytes = res.totalReclaimedBytes || 0;
        // Clean up any selected paths that no longer exist
        if (cleanupData?.candidates) {
          const validSet = new Set(cleanupData.candidates.map((c) => c.path));
          for (const p of selectedPaths) {
            if (!validSet.has(p)) selectedPaths.delete(p);
          }
        }
        renderAll();
      }
    });
  }

  // Event Listeners
  refreshBtn.addEventListener('click', () => {
    loadData();
    showToast('Refreshed cleanup data.');
  });

  revealFolderBtn.addEventListener('click', () => {
    if (cleanupData?.scannedPath && window.grumpyDuckApi?.revealInFinder) {
      window.grumpyDuckApi.revealInFinder(cleanupData.scannedPath);
      showToast('Opened folder in Finder.');
    }
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderCandidatesList();
  });

  categoryTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCategory = btn.getAttribute('data-category');
    renderCandidatesList();
  });

  recommendationSelect.addEventListener('change', (e) => {
    selectedRecommendation = e.target.value;
    renderCandidatesList();
  });

  // ── Multi-Selection Controls ──────────────────────────────────────────────
  function selectableFromVisible() {
    if (!cleanupData?.candidates) return [];
    return getFilteredCandidates().filter((c) => c.recommendation !== 'KEEP');
  }

  function syncMasterCheckbox() {
    const selectable = selectableFromVisible();
    if (!masterSelectAllCb) return;
    if (selectable.length === 0) {
      masterSelectAllCb.checked = false;
      masterSelectAllCb.indeterminate = false;
      if (masterSelectLabel) masterSelectLabel.textContent = 'Select All Cleanup Candidates';
      return;
    }
    const allSelected = selectable.every((c) => selectedPaths.has(c.path));
    const someSelected = selectable.some((c) => selectedPaths.has(c.path));
    masterSelectAllCb.indeterminate = someSelected && !allSelected;
    masterSelectAllCb.checked = allSelected;
    if (allSelected) {
      if (masterSelectLabel) masterSelectLabel.textContent = `All ${selectable.length} items selected`;
    } else if (someSelected) {
      if (masterSelectLabel) masterSelectLabel.textContent = `${selectedPaths.size} of ${selectable.length} selected`;
    } else {
      if (masterSelectLabel) masterSelectLabel.textContent = 'Select All Cleanup Candidates';
    }
  }

  function updateBatchBar() {
    syncMasterCheckbox();
    if (selectedPaths.size === 0) {
      batchActionBar.classList.add('hidden');
      return;
    }

    let totalSelectedBytes = 0;
    if (cleanupData?.candidates) {
      for (const c of cleanupData.candidates) {
        if (selectedPaths.has(c.path)) {
          totalSelectedBytes += c.size || 0;
        }
      }
    }

    batchSelectedCount.textContent = `${selectedPaths.size} file${selectedPaths.size === 1 ? '' : 's'}`;
    batchSelectedSize.textContent = `(${formatBytes(totalSelectedBytes)})`;
    batchActionBar.classList.remove('hidden');
  }

  function doSelectAll() {
    if (!cleanupData?.candidates) return;
    const visible = getFilteredCandidates();
    visible.forEach((c) => {
      if (c.recommendation !== 'KEEP') selectedPaths.add(c.path);
    });
    renderCandidatesList();
    updateBatchBar();
    showToast(`Selected ${selectedPaths.size} file${selectedPaths.size === 1 ? '' : 's'}.`);
  }

  function doDeselectAll() {
    selectedPaths.clear();
    renderCandidatesList();
    updateBatchBar();
  }

  // Master checkbox (header)
  if (masterSelectAllCb) {
    masterSelectAllCb.addEventListener('change', () => {
      if (masterSelectAllCb.checked) {
        doSelectAll();
      } else {
        doDeselectAll();
      }
    });
  }

  // Keyboard shortcut: Cmd/Ctrl+A = Select All
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      // Only trigger if not focused in an input/textarea
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      e.preventDefault();
      const selectable = selectableFromVisible();
      const allSelected = selectable.length > 0 && selectable.every((c) => selectedPaths.has(c.path));
      if (allSelected) {
        doDeselectAll();
      } else {
        doSelectAll();
      }
    }
  });

  selectAllBtn.addEventListener('click', () => {
    doSelectAll();
  });

  selectDupBtn.addEventListener('click', () => {
    if (!cleanupData?.candidates) return;
    cleanupData.candidates.forEach((c) => {
      if (c.category === 'DUPLICATE' && c.recommendation === 'POTENTIAL_CLEANUP') {
        selectedPaths.add(c.path);
      }
    });
    renderCandidatesList();
    updateBatchBar();
    showToast(`Selected ${selectedPaths.size} duplicate copies.`);
  });

  deselectAllBtn.addEventListener('click', () => {
    doDeselectAll();
  });

  batchCancelBtn.addEventListener('click', () => {
    doDeselectAll();
  });

  // Batch Move to Trash Action
  batchTrashBtn.addEventListener('click', () => {
    if (selectedPaths.size === 0) return;
    openBatchTrashModal();
  });

  function openBatchTrashModal() {
    if (!cleanupData?.candidates) return;
    const selectedItems = cleanupData.candidates.filter((c) => selectedPaths.has(c.path));
    if (selectedItems.length === 0) return;

    const totalBytes = selectedItems.reduce((acc, c) => acc + (c.size || 0), 0);

    batchModalTitle.textContent = `Move ${selectedItems.length} Files to macOS Trash?`;
    batchModalSubtitle.textContent = `Total space to reclaim: ${formatBytes(totalBytes)}`;

    batchModalItemsList.innerHTML = selectedItems
      .map(
        (c) => `
        <div class="batch-preview-row">
          <span class="preview-name" title="${escapeHtml(c.path)}">📄 ${escapeHtml(c.name)}</span>
          <span class="preview-size">${formatBytes(c.size || 0)}</span>
        </div>
      `
      )
      .join('');

    batchConfirmModal.classList.remove('hidden');
  }

  batchModalCancelBtn.addEventListener('click', () => {
    batchConfirmModal.classList.add('hidden');
  });

  batchModalConfirmBtn.addEventListener('click', async () => {
    batchConfirmModal.classList.add('hidden');
    const pathsArray = Array.from(selectedPaths);
    if (pathsArray.length === 0) return;

    try {
      let successCount = 0;
      let failureCount = 0;

      if (window.grumpyDuckApi?.moveToTrashBatch) {
        try {
          const res = await window.grumpyDuckApi.moveToTrashBatch(pathsArray);
          successCount = res.successCount || 0;
          failureCount = res.failureCount || 0;
          if (res.reclaimedBytes !== undefined) {
            totalReclaimedBytes = res.reclaimedBytes;
          }
        } catch (batchErr) {
          // Graceful fallback to sequential moveToTrash if running main process did not reload
          if (window.grumpyDuckApi?.moveToTrash) {
            for (const p of pathsArray) {
              try {
                const singleRes = await window.grumpyDuckApi.moveToTrash(p);
                if (singleRes && singleRes.success) {
                  successCount++;
                  if (singleRes.reclaimedBytes !== undefined) {
                    totalReclaimedBytes = singleRes.reclaimedBytes;
                  }
                } else {
                  failureCount++;
                }
              } catch {
                failureCount++;
              }
            }
          } else {
            throw batchErr;
          }
        }
      } else if (window.grumpyDuckApi?.moveToTrash) {
        for (const p of pathsArray) {
          try {
            const singleRes = await window.grumpyDuckApi.moveToTrash(p);
            if (singleRes && singleRes.success) {
              successCount++;
              if (singleRes.reclaimedBytes !== undefined) {
                totalReclaimedBytes = singleRes.reclaimedBytes;
              }
            } else {
              failureCount++;
            }
          } catch {
            failureCount++;
          }
        }
      }

      showToast(`Moved ${successCount} file${successCount === 1 ? '' : 's'} to Trash.`);
      selectedPaths.clear();
      updateBatchBar();
      await loadData();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // ── Single Item Modal Cancel & Confirm ────────────────────────────────────
  modalCancelBtn.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    pendingTrashCandidate = null;
  });

  modalConfirmBtn.addEventListener('click', async () => {
    if (!pendingTrashCandidate) return;
    const target = pendingTrashCandidate;
    confirmModal.classList.add('hidden');

    try {
      if (window.grumpyDuckApi?.moveToTrash) {
        const res = await window.grumpyDuckApi.moveToTrash(target.path);
        if (res.success) {
          showToast(`Moved ${target.name} to Trash.`);
          if (res.reclaimedBytes !== undefined) {
            totalReclaimedBytes = res.reclaimedBytes;
          }
          selectedPaths.delete(target.path);
          updateBatchBar();
          await loadData();
        } else {
          showToast(`Failed: ${res.error || 'Unknown error'}`);
        }
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      pendingTrashCandidate = null;
    }
  });

  function openTrashModal(candidate) {
    pendingTrashCandidate = candidate;
    modalFileName.textContent = candidate.name;
    modalFilePath.textContent = candidate.path;
    modalFileSize.textContent = formatBytes(candidate.size || 0);
    confirmModal.classList.remove('hidden');
  }

  // ── Render All Sections ───────────────────────────────────────────────────
  function renderAll() {
    if (!cleanupData || !cleanupData.candidates) {
      scannedPathDisplay.textContent = 'No scan performed yet';
      statTotalCandidates.textContent = '0';
      statDuplicateWasted.textContent = '0 B';
      statPotentialCleanup.textContent = '0';
      statReviewCount.textContent = '0';
      statReclaimedSpace.textContent = formatBytes(totalReclaimedBytes);
      candidatesContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🦆</span>
          <h2>No Cleanup Candidates</h2>
          <p>Run a scan from the GrumpyDuck desktop pet context menu to analyze files.</p>
        </div>
      `;
      updateTabCounts();
      updateBatchBar();
      return;
    }

    scannedPathDisplay.textContent = `${cleanupData.scannedPath} (${cleanupData.summary.totalScannedFiles} items)`;
    statTotalCandidates.textContent = cleanupData.summary.totalCandidates;
    statDuplicateWasted.textContent = formatBytes(cleanupData.summary.totalDuplicateWastedBytes);
    statPotentialCleanup.textContent = cleanupData.summary.potentialCleanupCount;
    statReviewCount.textContent = cleanupData.summary.reviewCount;
    statReclaimedSpace.textContent = formatBytes(totalReclaimedBytes);

    updateTabCounts();
    renderCandidatesList();
    updateBatchBar();
  }

  function updateTabCounts() {
    if (!cleanupData?.candidates) {
      countAll.textContent = '0';
      countDup.textContent = '0';
      countInst.textContent = '0';
      countLarge.textContent = '0';
      countOld.textContent = '0';
      countEmpty.textContent = '0';
      return;
    }

    const cList = cleanupData.candidates;
    countAll.textContent = cList.length;
    countDup.textContent = cList.filter((c) => c.category === 'DUPLICATE').length;
    countInst.textContent = cList.filter((c) => c.category === 'INSTALLER').length;
    countLarge.textContent = cList.filter((c) => c.category === 'LARGE_FILE').length;
    countOld.textContent = cList.filter((c) => c.category === 'OLD_FILE').length;
    countEmpty.textContent = cList.filter((c) => c.category === 'EMPTY_FOLDER').length;
  }

  function getFilteredCandidates() {
    if (!cleanupData?.candidates) return [];
    return cleanupData.candidates.filter((c) => {
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) {
        return false;
      }
      if (selectedRecommendation !== 'ALL' && c.recommendation !== selectedRecommendation) {
        return false;
      }
      if (searchQuery) {
        const nameMatch = c.name.toLowerCase().includes(searchQuery);
        const pathMatch = c.path.toLowerCase().includes(searchQuery);
        if (!nameMatch && !pathMatch) return false;
      }
      return true;
    });
  }

  function renderCandidatesList() {
    if (!cleanupData || !cleanupData.candidates || cleanupData.candidates.length === 0) {
      candidatesContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">✨</span>
          <h2>Your nest is clean!</h2>
          <p>No active cleanup candidates remain in this folder.</p>
        </div>
      `;
      return;
    }

    candidatesContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const showingDuplicatesGroupView =
      (selectedCategory === 'ALL' || selectedCategory === 'DUPLICATE') &&
      selectedRecommendation === 'ALL' &&
      searchQuery === '' &&
      cleanupData.duplicateGroups.length > 0;

    if (showingDuplicatesGroupView) {
      // 1. Render Duplicate Groups Section
      cleanupData.duplicateGroups.forEach((group) => {
        const groupCard = createDuplicateGroupCard(group);
        fragment.appendChild(groupCard);
      });
    }

    // 2. Filter Candidates for individual list
    const filtered = getFilteredCandidates().filter((c) => {
      if (showingDuplicatesGroupView && c.category === 'DUPLICATE') {
        return false;
      }
      return true;
    });

    if (filtered.length === 0 && (!showingDuplicatesGroupView || cleanupData.duplicateGroups.length === 0)) {
      candidatesContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔍</span>
          <h2>No matching files found</h2>
          <p>Try clearing your search query or selecting a different filter.</p>
        </div>
      `;
      return;
    }

    filtered.forEach((candidate) => {
      const card = createCandidateCard(candidate);
      fragment.appendChild(card);
    });

    candidatesContainer.appendChild(fragment);
  }

  // ── Duplicate Group Card Component ────────────────────────────────────────
  function createDuplicateGroupCard(group) {
    const card = document.createElement('div');
    card.className = 'duplicate-group-card';

    const shortHash = group.hash ? group.hash.substring(0, 10) : 'group';
    const copyCount = 1 + group.duplicates.length;

    card.innerHTML = `
      <div class="duplicate-group-header">
        <div class="dup-title-group">
          <span class="dup-icon">🐥</span>
          <div>
            <div class="dup-title">Duplicate Group (${copyCount} copies • ${formatBytes(group.size)} each)</div>
            <div class="file-full-path">SHA-256: ${shortHash}…</div>
          </div>
        </div>
        <div class="dup-recovery-badge">
          Potential Recovery: ${formatBytes(group.wastedBytes)}
        </div>
      </div>
      <div class="duplicate-copies-list">
        <!-- KEEP: Original -->
        <div class="duplicate-file-row is-original">
          <div class="file-left-meta">
            <div class="file-meta-texts">
              <div class="file-primary-name">
                <span>📄 ${escapeHtml(group.original.name)}</span>
                <span class="pill pill-keep">KEEP</span>
              </div>
              <div class="file-full-path" title="${escapeHtml(group.original.path)}">${escapeHtml(group.original.path)}</div>
            </div>
          </div>
          <div class="file-right-meta">
            <span class="file-size-badge">${formatBytes(group.original.size)}</span>
            <button class="btn btn-action reveal-btn" data-path="${escapeHtml(group.original.path)}">
              🔍 Reveal in Finder
            </button>
          </div>
        </div>

        <!-- POTENTIAL CLEANUP: Redundant Copies -->
        ${group.duplicates
          .map((dup) => {
            const isChecked = selectedPaths.has(dup.path);
            return `
          <div class="duplicate-file-row">
            <div class="file-left-meta">
              <input type="checkbox" class="item-checkbox dup-checkbox" data-path="${escapeHtml(dup.path)}" ${
              isChecked ? 'checked' : ''
            }>
              <div class="file-meta-texts">
                <div class="file-primary-name">
                  <span>🗑 ${escapeHtml(dup.name)}</span>
                  <span class="pill pill-potential-cleanup">POTENTIAL CLEANUP</span>
                </div>
                <div class="file-full-path" title="${escapeHtml(dup.path)}">${escapeHtml(dup.path)}</div>
              </div>
            </div>
            <div class="file-right-meta">
              <span class="file-size-badge">${formatBytes(dup.size)}</span>
              <button class="btn btn-action reveal-btn" data-path="${escapeHtml(dup.path)}">
                🔍 Reveal in Finder
              </button>
              <button class="btn btn-trash trash-btn" data-path="${escapeHtml(dup.path)}">
                🗑 Move to Trash
              </button>
            </div>
          </div>
        `;
          })
          .join('')}
      </div>
    `;

    // Checkbox changes
    card.querySelectorAll('.dup-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const filePath = cb.getAttribute('data-path');
        if (e.target.checked) {
          selectedPaths.add(filePath);
        } else {
          selectedPaths.delete(filePath);
        }
        updateBatchBar();
      });
    });

    // Reveal and trash buttons
    card.querySelectorAll('.reveal-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filePath = btn.getAttribute('data-path');
        if (window.grumpyDuckApi?.revealInFinder) {
          window.grumpyDuckApi.revealInFinder(filePath);
          showToast(`Revealed in Finder: ${filePath.split('/').pop()}`);
        }
      });
    });

    card.querySelectorAll('.trash-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filePath = btn.getAttribute('data-path');
        const dupCandidate = group.duplicates.find((d) => d.path === filePath);
        if (dupCandidate) {
          openTrashModal(dupCandidate);
        }
      });
    });

    return card;
  }

  // ── Standard Candidate Card Component ─────────────────────────────────────
  function createCandidateCard(candidate) {
    const card = document.createElement('div');
    card.className = 'candidate-card';

    const iconMap = {
      DUPLICATE: '📋',
      INSTALLER: '💿',
      LARGE_FILE: '📦',
      OLD_FILE: '🕰️',
      EMPTY_FOLDER: '📁',
    };

    const pillClassMap = {
      POTENTIAL_CLEANUP: 'pill-potential-cleanup',
      REVIEW: 'pill-review',
      KEEP: 'pill-keep',
    };

    const recLabelMap = {
      POTENTIAL_CLEANUP: 'POTENTIAL CLEANUP',
      REVIEW: 'REVIEW',
      KEEP: 'KEEP',
    };

    const icon = iconMap[candidate.category] || '📄';
    const pillClass = pillClassMap[candidate.recommendation] || 'pill-review';
    const recLabel = recLabelMap[candidate.recommendation] || candidate.recommendation;
    const isChecked = selectedPaths.has(candidate.path);

    card.innerHTML = `
      <div class="card-left-group">
        ${
          candidate.recommendation !== 'KEEP'
            ? `<input type="checkbox" class="item-checkbox candidate-checkbox" data-path="${escapeHtml(
                candidate.path
              )}" ${isChecked ? 'checked' : ''}>`
            : ''
        }
        <div class="card-details">
          <div class="card-title-row">
            <span class="card-icon">${icon}</span>
            <span class="card-name">${escapeHtml(candidate.name)}</span>
            <span class="pill ${pillClass}">${recLabel}</span>
            <span class="pill pill-category">${candidate.category.replace('_', ' ')}</span>
            <span class="pill pill-confidence">${candidate.confidence} CONFIDENCE</span>
          </div>
          <div class="file-full-path" title="${escapeHtml(candidate.path)}">${escapeHtml(candidate.path)}</div>
          <div class="card-reason">💡 ${escapeHtml(candidate.reason)}</div>
        </div>
      </div>
      <div class="file-right-meta">
        <span class="file-size-badge">${formatBytes(candidate.size || 0)}</span>
        <button class="btn btn-action card-reveal-btn">
          🔍 Reveal in Finder
        </button>
        ${
          candidate.recommendation !== 'KEEP'
            ? `<button class="btn btn-trash card-trash-btn">🗑 Move to Trash</button>`
            : ''
        }
      </div>
    `;

    const cb = card.querySelector('.candidate-checkbox');
    if (cb) {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedPaths.add(candidate.path);
        } else {
          selectedPaths.delete(candidate.path);
        }
        updateBatchBar();
      });
    }

    card.querySelector('.card-reveal-btn').addEventListener('click', () => {
      if (window.grumpyDuckApi?.revealInFinder) {
        window.grumpyDuckApi.revealInFinder(candidate.path);
        showToast(`Revealed in Finder: ${candidate.name}`);
      }
    });

    const trashBtn = card.querySelector('.card-trash-btn');
    if (trashBtn) {
      trashBtn.addEventListener('click', () => {
        openTrashModal(candidate);
      });
    }

    return card;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial load
  loadData();
});
