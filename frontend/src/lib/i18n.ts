export type Lang = 'en' | 'si';

interface Dict {
  brandTitle: string; brandSub: string; searchPh: string; allTools: string;
  statStore: string; statMachine: string; statTaken: string; statOverdue: string;
  productsTitle: string; assignLabel: string; machinePh: string; assignBtn: string;
  returnBtn: string; editBtn: string; deleteBtn: string; takenLabel: string; takenPh: string; takenBtn: string;
  overdueDays: (d: number) => string; storeNowBtn: string; overdueAfter: string; daysLabel: string;
  syncing: string; synced: string; offline: string; historyTitle: string; historyEmpty: string;
  taken: string; addTitle: string; editTitle: string; toolIdLabel: string; sizeLabel: string;
  pidLabel: string; descLabel: string; cavLabel: string; addProduct: string; removeProduct: string; addToolBtn: string; saveBtn: string;
  currentLocation: string; store: string; inStore: string; onMachine: string;
  emptyNoTools: string; emptyNoMatch: string;
  toastEnterMachine: string; toastEnterId: string; toastReturned: (id: string) => string; toastDeleted: string;
  toastAdded: (id: string) => string; toastUpdated: (id: string) => string; toastTaken: (id: string) => string;
  toastDupPid: string; toastEmptyPid: string; confirmDelete: (id: string) => string;
  histToStore: string; histToMachine: (n: string) => string; histToTaken: (n: string) => string; histCreated: string; histEdited: string;
  signIn: string; signingIn: string; email: string; password: string; signOut: string; changePassword: string;
  currentPassword: string; newPassword: string; repeatPassword: string; pwMismatch: string; pwChanged: string;
  users: string; addUser: string; name: string; role: string; active: string; disabled: string; close: string; cancel: string; offlineError: string;
  loginSub: string; reload: string;
}

export const I18N: Record<Lang, Dict> = {
  en: {
    brandTitle: 'Tool Tracker', brandSub: 'Store & Machine Finder', searchPh: 'Type Tool ID or Product ID...', allTools: 'All Tools',
    statStore: 'In Store', statMachine: 'On Machine', statTaken: 'Taken Out', statOverdue: 'Overdue',
    productsTitle: 'Products made by this tool', assignLabel: 'Send to a machine — enter machine name', machinePh: 'e.g. Machine 3, Press 1...',
    assignBtn: 'Send to Machine', returnBtn: 'Return to Store', editBtn: 'Edit Tool', deleteBtn: 'Delete Tool',
    takenLabel: 'Taken out — not in store, not on a machine (note optional)', takenPh: 'e.g. Taken by Sunil, for repair...', takenBtn: 'Mark as Taken Out',
    overdueDays: (d) => `Overdue ${d} days — store this tool`, storeNowBtn: 'Store This Tool Now', overdueAfter: 'Overdue after', daysLabel: 'days',
    syncing: 'Syncing...', synced: 'Live — synced with server', offline: 'Offline — cannot reach server',
    historyTitle: 'History', historyEmpty: 'No movement yet', taken: 'Taken Out', addTitle: 'Add New Tool', editTitle: 'Edit Tool',
    toolIdLabel: 'Tool ID', sizeLabel: 'Machine Size (T) — optional', pidLabel: 'Product ID', descLabel: 'Product Description', cavLabel: 'Cavities',
    addProduct: 'Add another product', removeProduct: 'Remove', addToolBtn: 'Add Tool', saveBtn: 'Save Changes',
    currentLocation: 'Current Location', store: 'Store', inStore: 'In Store', onMachine: 'On',
    emptyNoTools: 'No tools yet.<br>Tap the + button below to add your first tool.', emptyNoMatch: 'No tool matches your search.',
    toastEnterMachine: 'Enter a machine name', toastEnterId: 'Enter a Tool ID', toastReturned: (id) => `${id} returned to store`, toastDeleted: 'Tool deleted',
    toastAdded: (id) => `${id} added — in Store`, toastUpdated: (id) => `${id} updated`, toastTaken: (id) => `${id} marked as taken out`,
    toastDupPid: 'Two products in this tool have the same Product ID', toastEmptyPid: 'Every product needs a Product ID', confirmDelete: (id) => `Delete ${id}? This cannot be undone.`,
    histToStore: '→ Returned to Store', histToMachine: (n) => `→ Sent to ${n}`, histToTaken: (n) => (n ? `→ Taken Out: ${n}` : '→ Taken Out'), histCreated: '→ Added to Store', histEdited: '→ Details edited',
    signIn: 'Sign in', signingIn: 'Signing in…', email: 'Email', password: 'Password', signOut: 'Sign out', changePassword: 'Password',
    currentPassword: 'Current password', newPassword: 'New password (min 8 characters)', repeatPassword: 'Repeat new password', pwMismatch: 'The two new passwords do not match', pwChanged: 'Password changed',
    users: 'Users', addUser: 'Add user', name: 'Name', role: 'Role', active: 'Active', disabled: 'Disabled', close: 'Close', cancel: 'Cancel',
    offlineError: 'Cannot reach the server. Check that the backend is running.', loginSub: 'Sign in to see where every tool is.', reload: 'Reload'
  },
  si: {
    brandTitle: 'මෙවලම් සෙවුම', brandSub: 'ගබඩාව සහ මැෂින් සෙවීම', searchPh: 'Tool ID හෝ Product ID ටයිප් කරන්න...', allTools: 'සියලුම tools',
    statStore: 'ගබඩාවේ', statMachine: 'මැෂිමේ', statTaken: 'පිටතට අරන්', statOverdue: 'කල් ඉකුත්',
    productsTitle: 'මෙම tool එකෙන් හදන Products', assignLabel: 'මැෂිමකට දෙනවද? මැෂිම නම ලියන්න', machinePh: 'උදා: Machine 3, Press 1...',
    assignBtn: 'මැෂිමට දෙන්න', returnBtn: 'ගබඩාවට ආපසු දෙන්න', editBtn: 'මෙවලම සංස්කරණය කරන්න', deleteBtn: 'මෙවලම මකන්න',
    takenLabel: 'පිටතට අරන් ගියා — Store එකේත් නෑ, Machine එකේත් නෑ (Note එකක් විකල්පයි)', takenPh: 'උදා: සුනිල් අරන්, repair එකට...', takenBtn: 'පිටතට අරන් ගියා කියලා සලකුණු කරන්න',
    overdueDays: (d) => `දින ${d}ක් පිටතයි — මෙවලම ගබඩාවට දාන්න`, storeNowBtn: 'දැන් ගබඩාවට දාන්න', overdueAfter: 'කල් ඉකුත් වන්නේ', daysLabel: 'දින',
    syncing: 'Sync වෙමින්...', synced: 'Server එකත් එක්ක sync වෙලා', offline: 'Offline — server එකට සම්බන්ධ වෙන්න බෑ',
    historyTitle: 'History', historyEmpty: 'තවම movement එකක් නෑ', taken: 'පිටතට අරන් ගිහින්', addTitle: 'අලුත් මෙවලමක් එකතු කරන්න', editTitle: 'මෙවලම සංස්කරණය කරන්න',
    toolIdLabel: 'Tool ID', sizeLabel: 'Machine Size (T) — විකල්පයි', pidLabel: 'Product ID', descLabel: 'Product Description', cavLabel: 'Cavities',
    addProduct: 'තවත් product එකක් එකතු කරන්න', removeProduct: 'ඉවත් කරන්න', addToolBtn: 'එකතු කරන්න', saveBtn: 'වෙනස්කම් save කරන්න',
    currentLocation: 'දැනට තිබෙන තැන', store: 'ගබඩාව (Store)', inStore: 'ගබඩාවේ තිබේ', onMachine: '',
    emptyNoTools: 'තවම මෙවලම් නෑ.<br>පහළ + බටනය ගහලා පළවෙනි tool එක එකතු කරන්න.', emptyNoMatch: 'සෙවුමට ගැලපෙන tool එකක් නෑ.',
    toastEnterMachine: 'මැෂිම නම ලියන්න', toastEnterId: 'Tool ID එක ලියන්න', toastReturned: (id) => `${id} ගබඩාවට ආපසු ගියා`, toastDeleted: 'මෙවලම මකා දැමුවා',
    toastAdded: (id) => `${id} එකතු කරා — ගබඩාවේ`, toastUpdated: (id) => `${id} යාවත්කාලීන කළා`, toastTaken: (id) => `${id} පිටතට අරන් ගියා කියලා සලකුණු කරා`,
    toastDupPid: 'මේ tool එකේ products දෙකකට එකම Product ID එක තියෙනවා', toastEmptyPid: 'හැම product එකකටම Product ID එකක් ඕනේ', confirmDelete: (id) => `${id} මකන්නද? ආපසු ගන්න බෑ.`,
    histToStore: '→ ගබඩාවට ආපසු ගියා', histToMachine: (n) => `→ ${n} එකට දුන්නා`, histToTaken: (n) => (n ? `→ පිටතට අරන් ගියා: ${n}` : '→ පිටතට අරන් ගියා'), histCreated: '→ ගබඩාවට එකතු කරා', histEdited: '→ විස්තර වෙනස් කරා',
    signIn: 'ඇතුල් වෙන්න', signingIn: 'ඇතුල් වෙමින්…', email: 'Email', password: 'Password', signOut: 'ඉවත් වෙන්න', changePassword: 'Password',
    currentPassword: 'දැන් තියෙන password එක', newPassword: 'අලුත් password එක (අකුරු 8ක්වත්)', repeatPassword: 'අලුත් password එක නැවත', pwMismatch: 'අලුත් password දෙක ගැලපෙන්නේ නෑ', pwChanged: 'Password එක වෙනස් කරා',
    users: 'Users', addUser: 'User එකතු කරන්න', name: 'නම', role: 'Role', active: 'Active', disabled: 'Disabled', close: 'වහන්න', cancel: 'Cancel',
    offlineError: 'Server එකට සම්බන්ධ වෙන්න බෑ. Backend එක run වෙනවද බලන්න.', loginSub: 'ඇතුල් වෙලා tool එක තියෙන තැන බලන්න.', reload: 'Reload'
  }
};
