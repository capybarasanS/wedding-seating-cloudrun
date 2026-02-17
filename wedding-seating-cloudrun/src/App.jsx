import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Heart,
  Upload,
  Save,
  User,
  Users,
  UserPlus,
  Edit2,
  Trash2,
  HelpCircle,
  X,
  Plus
} from 'lucide-react';

const SAMPLE_GUESTS = [
  { id: 'g1', name: '佐藤 太郎', side: 'groom', category: '主賓', title: '株式会社ABC 代表', special: '', isTentative: false },
  { id: 'g2', name: '田中 一郎', side: 'groom', category: '職場', title: '部長', special: 'allergy', isTentative: false },
  { id: 'g3', name: '鈴木 幸子', side: 'bride', category: '親族', title: '伯母', special: 'wheelchair', isTentative: true }
];

const DEFAULT_TABLES = [
  { id: 't1', name: '松', capacity: 8 },
  { id: 't2', name: '竹', capacity: 8 },
  { id: 't3', name: '梅', capacity: 8 },
  { id: 't4', name: '蘭', capacity: 8 }
];

function getInitialProject() {
  return {
    guests: SAMPLE_GUESTS,
    layouts: [
      {
        id: 'l1',
        name: '基本プラン',
        tables: DEFAULT_TABLES,
        assignments: {},
        gridCols: 2
      }
    ],
    activeLayoutId: 'l1'
  };
}

function createProjectId() {
  return `plan-${Math.random().toString(36).slice(2, 10)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const listener = (event) => setIsMobile(event.matches);
    if (media.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
    media.addListener(listener);
    return () => media.removeListener(listener);
  }, []);

  return isMobile;
}

export default function App() {
  const isMobile = useIsMobile();
  const fileInputRef = useRef(null);
  const loadedRef = useRef(false);
  const autoSaveTimerRef = useRef(null);

  const [projectId, setProjectId] = useState('');
  const [guests, setGuests] = useState(SAMPLE_GUESTS);
  const [layouts, setLayouts] = useState([{ id: 'l1', name: '基本プラン', tables: DEFAULT_TABLES, assignments: {}, gridCols: 2 }]);
  const [activeLayoutId, setActiveLayoutId] = useState('l1');
  const [isEditingTables, setIsEditingTables] = useState(false);
  const [draggedTableId, setDraggedTableId] = useState(null);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedGuestIdMobile, setSelectedGuestIdMobile] = useState(null);
  const [statusText, setStatusText] = useState('読み込み中...');
  const [isSaving, setIsSaving] = useState(false);

  const [currentGuestForm, setCurrentGuestForm] = useState({
    id: '',
    name: '',
    side: 'groom',
    title: '',
    category: '',
    isTentative: false,
    special: ''
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const p = url.searchParams.get('p');
    const stored = localStorage.getItem('wedding_project_id');
    const nextId = p || stored || createProjectId();
    setProjectId(nextId);
    localStorage.setItem('wedding_project_id', nextId);

    if (!p) {
      url.searchParams.set('p', nextId);
      window.history.replaceState({}, '', url.toString());
    }

    loadProject(nextId);
  }, []);

  const activeLayout = useMemo(() => {
    return layouts.find((l) => l.id === activeLayoutId) || layouts[0];
  }, [layouts, activeLayoutId]);

  const tables = activeLayout?.tables || [];
  const assignments = activeLayout?.assignments || {};
  const gridCols = activeLayout?.gridCols || 2;

  const guestMap = useMemo(() => {
    const map = {};
    guests.forEach((g) => {
      map[g.id] = g;
    });
    return map;
  }, [guests]);

  const guestLocationMap = useMemo(() => {
    const map = {};
    Object.entries(assignments).forEach(([tId, seats]) => {
      Object.entries(seats || {}).forEach(([sIdx, gId]) => {
        if (gId) map[gId] = { tableId: tId, seatIndex: Number(sIdx) };
      });
    });
    return map;
  }, [assignments]);

  const unassignedGuests = useMemo(() => guests.filter((g) => !guestLocationMap[g.id]), [guests, guestLocationMap]);

  const stats = useMemo(() => {
    const total = guests.length;
    const tentative = guests.filter((g) => g.isTentative).length;
    const placed = Object.keys(guestLocationMap).length;
    return { total, tentative, placed };
  }, [guests, guestLocationMap]);

  function updateActiveLayout(updates) {
    setLayouts((prev) => prev.map((l) => (l.id === activeLayoutId ? { ...l, ...updates } : l)));
  }

  async function loadProject(id) {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      setGuests(data.guests || []);
      setLayouts(data.layouts?.length ? data.layouts : getInitialProject().layouts);
      setActiveLayoutId(data.activeLayoutId || 'l1');
      setStatusText('クラウド同期済み');
    } catch (error) {
      const fallback = getInitialProject();
      setGuests(fallback.guests);
      setLayouts(fallback.layouts);
      setActiveLayoutId(fallback.activeLayoutId);
      setStatusText('初期データで開始 (オフライン)');
    } finally {
      loadedRef.current = true;
    }
  }

  async function saveProject(nowState) {
    if (!projectId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nowState)
      });
      if (!res.ok) throw new Error('save failed');
      setStatusText(`保存完了: ${new Date().toLocaleTimeString('ja-JP')}`);
    } catch (error) {
      setStatusText('保存エラー: 再試行してください');
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (!loadedRef.current || !projectId) return;
    const payload = { guests, layouts, activeLayoutId };

    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveProject(payload);
    }, 1200);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [guests, layouts, activeLayoutId, projectId]);

  function openAddModal() {
    setModalMode('add');
    setCurrentGuestForm({ id: '', name: '', side: 'groom', title: '', category: '', isTentative: false, special: '' });
    setIsGuestModalOpen(true);
  }

  function openEditModal(guest) {
    setModalMode('edit');
    setCurrentGuestForm({ ...guest });
    setIsGuestModalOpen(true);
  }

  function handleSaveGuest(event) {
    event.preventDefault();
    if (!currentGuestForm.name.trim()) return;

    if (modalMode === 'add') {
      const newGuest = { ...currentGuestForm, id: `g-${Date.now()}` };
      setGuests((prev) => [...prev, newGuest]);
    } else {
      setGuests((prev) => prev.map((g) => (g.id === currentGuestForm.id ? currentGuestForm : g)));
    }
    setIsGuestModalOpen(false);
  }

  function handleDeleteGuest(guestId) {
    setGuests((prev) => prev.filter((g) => g.id !== guestId));
    setLayouts((prevLayouts) => {
      return prevLayouts.map((layout) => {
        const nextAssignments = clone(layout.assignments || {});
        Object.keys(nextAssignments).forEach((tId) => {
          Object.keys(nextAssignments[tId] || {}).forEach((sIdx) => {
            if (nextAssignments[tId][sIdx] === guestId) {
              delete nextAssignments[tId][sIdx];
            }
          });
        });
        return { ...layout, assignments: nextAssignments };
      });
    });
  }

  function handleToggleTentative(guestId) {
    setGuests((prev) => prev.map((g) => (g.id === guestId ? { ...g, isTentative: !g.isTentative } : g)));
  }

  function handleCapacityChange(tableId, capacity) {
    const nextAssignments = clone(assignments);
    Object.keys(nextAssignments[tableId] || {}).forEach((seatIdxStr) => {
      if (Number(seatIdxStr) >= capacity) delete nextAssignments[tableId][seatIdxStr];
    });
    const nextTables = tables.map((t) => (t.id === tableId ? { ...t, capacity } : t));
    updateActiveLayout({ tables: nextTables, assignments: nextAssignments });
  }

  function handleGuestAssignment(movingGuestId, targetTableId, targetSeatIndex) {
    const nextAssignments = clone(assignments);
    const source = guestLocationMap[movingGuestId];

    if (targetTableId === null) {
      if (source) delete nextAssignments[source.tableId][source.seatIndex];
      updateActiveLayout({ assignments: nextAssignments });
      return;
    }

    if (!nextAssignments[targetTableId]) nextAssignments[targetTableId] = {};

    const currentTargetGuestId = nextAssignments[targetTableId][targetSeatIndex];

    if (currentTargetGuestId && source) {
      nextAssignments[source.tableId][source.seatIndex] = currentTargetGuestId;
    } else if (source) {
      delete nextAssignments[source.tableId][source.seatIndex];
    }

    nextAssignments[targetTableId][targetSeatIndex] = movingGuestId;
    updateActiveLayout({ assignments: nextAssignments });
  }

  function onGuestDragStart(event, guestId) {
    event.dataTransfer.setData('type', 'guest');
    event.dataTransfer.setData('guestId', guestId);
  }

  function onTableDragStart(event, tableId) {
    event.dataTransfer.setData('type', 'table');
    event.dataTransfer.setData('sourceTableId', tableId);
    setDraggedTableId(tableId);
  }

  function onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function onDropToSeat(event, tableId, seatIndex) {
    event.preventDefault();
    const type = event.dataTransfer.getData('type');
    if (type === 'guest') {
      const guestId = event.dataTransfer.getData('guestId');
      handleGuestAssignment(guestId, tableId, seatIndex);
    }
  }

  function onDropToTable(event, targetTableId) {
    event.preventDefault();
    const type = event.dataTransfer.getData('type');

    if (type === 'table' && isEditingTables) {
      const sourceTableId = event.dataTransfer.getData('sourceTableId');
      if (sourceTableId === targetTableId) return;
      const nextTables = [...tables];
      const sourceIdx = nextTables.findIndex((t) => t.id === sourceTableId);
      const targetIdx = nextTables.findIndex((t) => t.id === targetTableId);
      const [moved] = nextTables.splice(sourceIdx, 1);
      nextTables.splice(targetIdx, 0, moved);
      updateActiveLayout({ tables: nextTables });
      setDraggedTableId(null);
      return;
    }

    if (type === 'guest') {
      const guestId = event.dataTransfer.getData('guestId');
      const table = tables.find((t) => t.id === targetTableId);
      const seats = assignments[targetTableId] || {};
      let firstEmpty = -1;
      for (let i = 0; i < table.capacity; i += 1) {
        if (!seats[i]) {
          firstEmpty = i;
          break;
        }
      }
      if (firstEmpty >= 0) handleGuestAssignment(guestId, targetTableId, firstEmpty);
    }
  }

  function onSeatClickMobile(tableId, seatIndex) {
    if (!isMobile) return;

    const seats = assignments[tableId] || {};
    const occupant = seats[seatIndex] || null;

    if (selectedGuestIdMobile) {
      handleGuestAssignment(selectedGuestIdMobile, tableId, seatIndex);
      setSelectedGuestIdMobile(null);
      return;
    }

    if (occupant) {
      setSelectedGuestIdMobile(occupant);
    }
  }

  function handleCSVImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) return;

      const nextGuests = [];
      const nextAssignments = {};
      const nextTables = [...tables];

      lines.slice(1).forEach((line, idx) => {
        if (!line.trim()) return;
        const [name, sideStr, category, title, tableName, seatNumStr, note] = line.split(',').map((s) => (s || '').trim());
        if (!name) return;

        const guestId = `csv-${Date.now()}-${idx}`;
        nextGuests.push({
          id: guestId,
          name,
          side: sideStr === '新婦' || sideStr === 'bride' ? 'bride' : 'groom',
          category,
          title,
          special: note,
          isTentative: note.includes('検討中')
        });

        if (tableName && tableName !== '未配置' && tableName !== '-') {
          let table = nextTables.find((t) => t.name === tableName);
          if (!table) {
            table = { id: `t-auto-${tableName}`, name: tableName, capacity: 8 };
            nextTables.push(table);
          }
          const seatIndex = Number(seatNumStr) - 1;
          if (!Number.isNaN(seatIndex) && seatIndex >= 0) {
            if (seatIndex >= table.capacity) table.capacity = seatIndex + 1;
            if (!nextAssignments[table.id]) nextAssignments[table.id] = {};
            nextAssignments[table.id][seatIndex] = guestId;
          }
        }
      });

      if (nextGuests.length) {
        setGuests(nextGuests);
        updateActiveLayout({ tables: nextTables, assignments: nextAssignments });
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  }

  function exportToCSV() {
    let csv = '\ufeff氏名,側,カテゴリー,肩書き,テーブル,席番号,備考\n';
    guests.forEach((guest) => {
      const loc = guestLocationMap[guest.id];
      const tableName = loc ? tables.find((t) => t.id === loc.tableId)?.name : '未配置';
      const seatNo = loc ? loc.seatIndex + 1 : '-';
      const note = `${guest.isTentative ? '[検討中] ' : ''}${guest.special || ''}`;
      csv += `${guest.name},${guest.side === 'groom' ? '新郎' : '新婦'},${guest.category || ''},${guest.title || ''},${tableName || '未配置'},${seatNo},${note}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `wedding-seating-${projectId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const ui = useMemo(() => {
    const base = {
      1: { gridCols: 1, tableSize: isMobile ? 260 : 320, radius: isMobile ? 112 : 138, seatSize: isMobile ? 46 : 56 },
      2: { gridCols: isMobile ? 1 : 2, tableSize: isMobile ? 250 : 280, radius: isMobile ? 106 : 118, seatSize: isMobile ? 44 : 50 },
      3: { gridCols: isMobile ? 1 : 3, tableSize: isMobile ? 240 : 240, radius: isMobile ? 100 : 98, seatSize: isMobile ? 42 : 44 },
      4: { gridCols: isMobile ? 2 : 4, tableSize: isMobile ? 220 : 200, radius: isMobile ? 88 : 78, seatSize: isMobile ? 36 : 38 }
    };
    return base[gridCols] || base[2];
  }, [gridCols, isMobile]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="logo"><Heart size={16} /></span>
          <div>
            <h1>Wedding Seating Cloud</h1>
            <p>Project: {projectId || '---'}</p>
          </div>
        </div>
        <div className="header-actions">
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVImport} hidden />
          <button className="btn ghost" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> CSV読込</button>
          <button className="btn" onClick={exportToCSV}><Save size={14} /> CSV出力</button>
          <button
            className="btn primary"
            disabled={isSaving}
            onClick={() => saveProject({ guests, layouts, activeLayoutId })}
          >
            <Save size={14} /> {isSaving ? '保存中...' : 'クラウド保存'}
          </button>
        </div>
      </header>

      <div className="sub-header">
        <div className="layout-tabs">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              className={`tab ${layout.id === activeLayoutId ? 'active' : ''}`}
              onClick={() => setActiveLayoutId(layout.id)}
            >
              {layout.name}
            </button>
          ))}
        </div>
        <div className="sync-status">{statusText}</div>
      </div>

      {isMobile && (
        <div className="mobile-hint">
          {selectedGuestIdMobile ? `選択中: ${guestMap[selectedGuestIdMobile]?.name || ''} / 席をタップで移動` : 'モバイル: ゲストをタップで選択→席をタップで配置'}
        </div>
      )}

      <div className="workspace">
        <aside className="sidebar">
          <div className="side-head">
            <h2><Users size={15} /> ゲスト ({stats.total})</h2>
            <button className="icon-btn" onClick={openAddModal}><UserPlus size={16} /></button>
          </div>

          <div
            className="guest-list"
            onDragOver={onDragOver}
            onDrop={(event) => {
              const guestId = event.dataTransfer.getData('guestId');
              if (guestId) handleGuestAssignment(guestId, null, null);
            }}
          >
            {unassignedGuests.map((guest) => (
              <div
                key={guest.id}
                className={`guest-item ${guest.isTentative ? 'tentative' : ''} ${selectedGuestIdMobile === guest.id ? 'selected' : ''}`}
                draggable={!isMobile}
                onDragStart={(event) => onGuestDragStart(event, guest.id)}
                onDoubleClick={() => openEditModal(guest)}
                onClick={() => isMobile && setSelectedGuestIdMobile(guest.id)}
              >
                <div className={`side-dot ${guest.side === 'groom' ? 'groom' : 'bride'}`} />
                <div className="guest-info">
                  <strong>{guest.name}</strong>
                  <small>{guest.category || 'カテゴリー未設定'} / {guest.title || '肩書き未設定'}</small>
                </div>
                <div className="guest-actions">
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEditModal(guest); }}><Edit2 size={14} /></button>
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleToggleTentative(guest.id); }}><HelpCircle size={14} /></button>
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleDeleteGuest(guest.id); }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}

            {!unassignedGuests.length && <div className="empty">全員配置済み</div>}
          </div>

          <div className="stats">
            <div>配置済み {stats.placed}/{stats.total}</div>
            <div>検討中 {stats.tentative}</div>
          </div>
        </aside>

        <main className="canvas">
          <div className="tools">
            <label>列数 {gridCols}</label>
            <input
              type="range"
              min="1"
              max="4"
              value={gridCols}
              onChange={(e) => updateActiveLayout({ gridCols: Number(e.target.value) })}
            />
            <button className={`btn ${isEditingTables ? 'primary' : 'ghost'}`} onClick={() => setIsEditingTables((v) => !v)}>
              会場編集モード
            </button>
          </div>

          <section className="tables-grid" style={{ '--cols': ui.gridCols }}>
            {tables.map((table) => {
              const tableSeats = assignments[table.id] || {};
              return (
                <article
                  key={table.id}
                  className={`table-card ${draggedTableId === table.id ? 'dragging' : ''}`}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDropToTable(e, table.id)}
                >
                  <div
                    className={`table-head ${isEditingTables ? 'editable' : ''}`}
                    draggable={isEditingTables && !isMobile}
                    onDragStart={(e) => onTableDragStart(e, table.id)}
                  >
                    {isEditingTables ? (
                      <input
                        value={table.name}
                        onChange={(e) => {
                          const nextTables = tables.map((t) => (t.id === table.id ? { ...t, name: e.target.value } : t));
                          updateActiveLayout({ tables: nextTables });
                        }}
                      />
                    ) : (
                      <span>Table {table.name}</span>
                    )}
                    {isEditingTables && (
                      <button
                        className="icon-btn"
                        onClick={() => {
                          updateActiveLayout({ tables: tables.filter((t) => t.id !== table.id) });
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="table-round" style={{ width: ui.tableSize, height: ui.tableSize }}>
                    <div className="table-name">{table.name.charAt(0)}</div>
                    {Array.from({ length: table.capacity }).map((_, i) => {
                      const angle = (i * (360 / table.capacity)) - 90;
                      const x = Math.cos((angle * Math.PI) / 180) * ui.radius;
                      const y = Math.sin((angle * Math.PI) / 180) * ui.radius;
                      const guestId = tableSeats[i];
                      const guest = guestMap[guestId];

                      return (
                        <div
                          key={i}
                          className="seat-wrap"
                          style={{ transform: `translate(${x}px, ${y}px)` }}
                          onDragOver={onDragOver}
                          onDrop={(e) => onDropToSeat(e, table.id, i)}
                          onClick={() => onSeatClickMobile(table.id, i)}
                        >
                          {guest ? (
                            <button
                              className={`seat occupied ${guest.side} ${guest.isTentative ? 'tentative' : ''}`}
                              style={{ width: ui.seatSize, height: ui.seatSize }}
                              draggable={!isMobile}
                              onDragStart={(e) => onGuestDragStart(e, guest.id)}
                              onDoubleClick={() => openEditModal(guest)}
                              onClick={() => {
                                if (isMobile) setSelectedGuestIdMobile(guest.id);
                              }}
                              title={guest.name}
                            >
                              {guest.name.split(' ')[0]}
                            </button>
                          ) : (
                            <button className="seat" style={{ width: ui.seatSize, height: ui.seatSize }}>
                              <User size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="table-footer">
                    <button className="icon-btn" onClick={() => handleCapacityChange(table.id, Math.max(4, table.capacity - 1))}>-</button>
                    <span>{table.capacity}席</span>
                    <button className="icon-btn" onClick={() => handleCapacityChange(table.id, Math.min(12, table.capacity + 1))}>+</button>
                  </div>
                </article>
              );
            })}

            {isEditingTables && (
              <button
                className="add-table"
                onClick={() => {
                  const newTable = { id: `t-${Date.now()}`, name: String(tables.length + 1), capacity: 8 };
                  updateActiveLayout({ tables: [...tables, newTable] });
                }}
              >
                <Plus size={22} />
                <span>テーブル追加</span>
              </button>
            )}
          </section>
        </main>
      </div>

      {isGuestModalOpen && (
        <div className="modal-bg" onClick={() => setIsGuestModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modalMode === 'add' ? 'ゲスト登録' : 'ゲスト編集'}</h3>
              <button className="icon-btn" onClick={() => setIsGuestModalOpen(false)}><X size={18} /></button>
            </div>
            <form className="modal-body" onSubmit={handleSaveGuest}>
              <label>
                ゲスト名
                <input
                  required
                  value={currentGuestForm.name}
                  onChange={(e) => setCurrentGuestForm({ ...currentGuestForm, name: e.target.value })}
                />
              </label>
              <div className="radio-row">
                <button type="button" className={currentGuestForm.side === 'groom' ? 'active' : ''} onClick={() => setCurrentGuestForm({ ...currentGuestForm, side: 'groom' })}>新郎側</button>
                <button type="button" className={currentGuestForm.side === 'bride' ? 'active' : ''} onClick={() => setCurrentGuestForm({ ...currentGuestForm, side: 'bride' })}>新婦側</button>
              </div>
              <label>
                カテゴリー
                <input
                  value={currentGuestForm.category}
                  onChange={(e) => setCurrentGuestForm({ ...currentGuestForm, category: e.target.value })}
                />
              </label>
              <label>
                肩書き
                <input
                  value={currentGuestForm.title}
                  onChange={(e) => setCurrentGuestForm({ ...currentGuestForm, title: e.target.value })}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={currentGuestForm.isTentative}
                  onChange={(e) => setCurrentGuestForm({ ...currentGuestForm, isTentative: e.target.checked })}
                />
                検討中として登録
              </label>
              <button className="btn primary" type="submit">{modalMode === 'add' ? '追加' : '更新'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
