import { useMemo, useState } from 'react';
import { AppSettings, KidId, WishItem } from './types';
import { KIDS } from './data/kids';
import { daysUntil, loadItems, loadSettings, Reminder, saveItems, saveSettings } from './storage';
import KidSelect from './components/KidSelect';
import WishList from './components/WishList';
import SettingsModal from './components/SettingsModal';
import ReminderBanner from './components/ReminderBanner';
import './App.css';

type ItemsByKid = Record<KidId, WishItem[]>;

const CHRISTMAS = '12-25';
const REMINDER_DAYS_BIRTHDAY = 30;
const REMINDER_DAYS_CHRISTMAS = 45;

export default function App() {
  const [selectedKidId, setSelectedKidId] = useState<KidId | null>(null);
  const [itemsByKid, setItemsByKid] = useState<ItemsByKid>(() => ({
    mason: loadItems('mason'),
    caden: loadItems('caden'),
    felix: loadItems('felix'),
  }));
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(false);

  const selectedKid = selectedKidId ? KIDS.find(k => k.id === selectedKidId)! : null;

  const reminders = useMemo<Reminder[]>(() => {
    const result: Reminder[] = [];
    const xmasDays = daysUntil(CHRISTMAS);
    if (xmasDays <= REMINDER_DAYS_CHRISTMAS) {
      result.push({ label: '🎄 Christmas', daysUntil: xmasDays });
    }
    for (const kid of KIDS) {
      const bday = settings.birthdays[kid.id];
      if (!bday) continue;
      const days = daysUntil(bday);
      if (days <= REMINDER_DAYS_BIRTHDAY) {
        result.push({ label: `${kid.emoji} ${kid.name}'s Birthday`, daysUntil: days, kidId: kid.id });
      }
    }
    return result.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [settings]);

  function updateItems(kidId: KidId, items: WishItem[]) {
    setItemsByKid(prev => ({ ...prev, [kidId]: items }));
    saveItems(kidId, items);
  }

  function handleCopyItem(toKidId: KidId, item: WishItem) {
    const copy: WishItem = {
      ...item,
      id: crypto.randomUUID(),
      bought: false,
      claimedBy: undefined,
      addedAt: new Date().toISOString(),
    };
    updateItems(toKidId, [copy, ...itemsByKid[toKidId]]);
  }

  function handleSaveSettings(newSettings: AppSettings) {
    setSettings(newSettings);
    saveSettings(newSettings);
  }

  const showBanner = !reminderDismissed && reminders.length > 0 && !selectedKid;

  if (!selectedKid) {
    return (
      <>
        {showBanner && (
          <ReminderBanner
            reminders={reminders}
            onDismiss={() => setReminderDismissed(true)}
          />
        )}
        <KidSelect
          kids={KIDS}
          itemsByKid={itemsByKid}
          onSelect={setSelectedKidId}
          onOpenSettings={() => setShowSettings(true)}
        />
        {showSettings && (
          <SettingsModal
            kids={KIDS}
            settings={settings}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </>
    );
  }

  return (
    <WishList
      kid={selectedKid}
      items={itemsByKid[selectedKid.id]}
      allKids={KIDS}
      onItemsChange={items => updateItems(selectedKid.id, items)}
      onBack={() => setSelectedKidId(null)}
      onCopyItem={handleCopyItem}
    />
  );
}
