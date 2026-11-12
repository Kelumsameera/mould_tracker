// All UI text, English and Sinhala. `si` is typed as `Dict`, so a missing Sinhala string fails the build.
// "Mould Room" lives in exactly one key (`mouldRoom`); everything else refers to it.
import type { Location, MouldStatus, Role, WorkType } from "@/utils/types";
import type { Permission } from "@/utils/permissions";

export type Lang = 'en' | 'si';
type D = Record<string, unknown>; // error detail values sent by the server

const en = {
  rackLayout: {
    title: 'Mould storage & identification', format: 'Location format', formatHint: 'Rack – Pallet / Level – Position',
    layout: 'Storage rack layout', rack: 'Rack', pallet: 'Pallet / level', position: 'Position', legacy: 'Existing locations',
    search: 'Find a mould or location', searchHint: 'Mould ID, product ID, description or A-P1-1',
    positions: 'positions', noPositions: 'No storage positions yet.', table: 'Mould location table', showAll: 'Show all',
    mould: 'Mould ID', product: 'Product ID', description: 'Description', location: 'Location', cavities: 'Cavities', machine: 'Machine / size',
    noResults: 'No stored moulds match this selection.', palletFrom: 'Pallet / level from', palletTo: 'Pallet / level to',
  },
  themeLight: 'Switch to light theme',
  themeDark: 'Switch to dark theme',
  toolType: 'Tool category',
  toolTypes: { INJECTION_MOULD: 'Injection Moulds', EXTRUSION_DIE: 'Extrusion Die Tools' },
  extrusionResults: (n: number) => `${n} extrusion die tools`,
  extrusionEmpty: 'No extrusion die tools found.',
  extrusionSearch: 'Die ID, Pin ID, Item ID, description or machine',
  extrusionAdd: 'Add extrusion die tool',
  extrusionShort: 'Extrusion',
  extrusionEdit: 'Edit extrusion die tool',
  mouldRoom: 'Mould Room',
  brandTitle: 'Mould Tracker',
  brandSub: 'Find any mould in seconds',
  loc: { MACHINE: 'Machine', PRODUCTION_FLOOR: 'Production Floor', ISOLATION: 'Isolation Area', WORKSHOP: 'Workshop', TOOL_ROOM: 'Tool Room', OUT_OF_SERVICE: 'Out of Service' } as Record<Exclude<Location, 'MOULD_ROOM'>, string>,
  status: { GOOD: 'Good', NEEDS_SERVICE: 'Needs service', NEEDS_REPAIR: 'Needs repair', IN_SERVICE: 'In service', IN_REPAIR: 'In repair', RUNNING_LIMITED: 'Running – needs repair' } as Record<MouldStatus, string>,
  isolation: {
    title: 'Isolation Area', hint: 'Moulds waiting between the Production Floor, the Mould Room and the Workshop. Every move that does not end on a machine passes here.',
    empty: 'Nothing is waiting in the Isolation Area.', send: 'Send to Isolation Area', moveOn: 'Move on', plannedFor: 'Waiting to go to', notDecided: 'Not decided yet',
    choosePlan: 'Where should it go next? (optional)', setStatus: 'Status (optional)', waiting: (d: string) => `waiting ${d}`, waitingFor: (d: string) => `Waiting ${d}`,
    tooLong: 'Waiting too long', tooLongCount: (n: number) => `${n} waiting too long`, stayed: (d: string) => `stayed ${d} in Isolation`, from: 'Came from'
  },
  dashboard: {
    title: 'Dashboard', hint: 'Where every mould is, what needs attention and the work done this month.',
    byLocation: 'By location', byStatus: 'By status', limited: 'Running with blocked cavities', isolationTooLong: 'Waiting too long in Isolation',
    serviceDue: 'Service due by shots', workThisMonth: 'Work done this month', entries: (n: number) => `${n} entries`, none: 'None', total: (n: number) => `${n} moulds`
  },
  cavity: {
    action: 'Run with blocked cavities', change: 'Change blocked cavities', title: 'Run with blocked cavities',
    hint: 'Production keeps running this mould with some cavities closed. Tap the cavities that are blocked.',
    noCavities: 'Enter the number of cavities on the items first.', reason: 'Reason', reasonRequired: 'A reason is required.',
    problemType: 'Problem type (optional)', photo: 'Photo (optional)', expectedFix: 'Expected fix date (optional)',
    summary: (active: number, total: number) => `${active} of ${total} cavities active`, badge: (active: number, total: number, d: string) => `${active}/${total} cavities${d ? ` · since ${d}` : ''}`,
    restoreAll: 'Restore all cavities', confirmTitle: 'Blocked cavities', confirm: (tool: string, active: number, total: number) => `${tool}: ${active} of ${total} cavities active. Save?`,
    confirmRestore: (tool: string) => `Restore all cavities of ${tool}? It becomes Good again.`, saved: 'Cavities saved', restored: 'All cavities restored',
    filter: 'Running with blocked cavities', queue: 'Needs repair but running', tooLong: 'Running limited too long',
    downtime: 'Cavity downtime', downtimeEmpty: 'No cavities have been blocked.', period: 'Period', which: 'Blocked cavities', open: 'still blocked', decidedBy: 'Decided by', expectedBy: (d: string) => `fix expected by ${d}`
  },
  duration: (days: number, hours: number, minutes: number) => (days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`),
  roles: { system_admin: 'System Administrator', super_admin: 'Super Admin', admin: 'Admin', production_supervisor: 'Production Supervisor', mould_technician: 'Mould Technician', mould_maker: 'Mould Maker', executive: 'Executive' } as Record<Role, string>,
  rolesHelp: 'Super Admin: everything • Admin: moulds and users • Production Supervisor: machine changes • Mould Technician: machine changes, service and repair • Mould Maker: Mould Room, service and repair',

  nav: {
    documentation: 'Documentation',
    find: 'Find a mould', racks: 'Rack view', workshop: 'Workshop queue', admin: 'Admin', superAdmin: 'Super Admin',
    machines: 'Machines', users: 'Users', rackAdmin: 'Rack management', audit: 'Audit log', workReport: 'Work log report', account: 'Account details', menu: 'Menu', closeMenu: 'Close menu',
    language: 'Language', findShort: 'Find', racksShort: 'Racks', workshopShort: 'Workshop', more: 'More', expand: 'Expand menu', collapse: 'Collapse menu', accountMenu: 'Account and menu'
  },
  sync: { syncing: 'Syncing…', synced: 'Live — synced with server', offline: 'Offline — cannot reach server' },

  search: {
    placeholder: 'Tool ID, Item ID, description, machine or rack',
    clear: 'Clear search',
    results: (n: number) => (n === 1 ? '1 mould' : `${n} moulds`),
    allMoulds: 'All moulds',
    noMatch: 'No mould matches your search.',
    empty: 'No moulds yet.'
  },
  dash: { total: 'All', attention: 'Service / repair', awaitingRack: 'No rack yet', filterOn: 'Filter on', clearFilter: 'Show all' },

  card: {
    moved: (when: string, who: string) => (who ? `Moved ${when} · ${who}` : `Moved ${when}`),
    items: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    noRack: 'no rack yet',
    shotsDue: 'Service due'
  },

  detail: {
    items: 'Items made by this mould', noItems: 'No items listed.', capableMachines: 'Capable machines', none: 'None listed',
    shots: 'Shots', shotsOf: (a: number, b: number | null) => (b ? `${a.toLocaleString()} / ${b.toLocaleString()}` : a.toLocaleString()),
    serviceDue: 'Shot limit reached — service due', lastServiced: 'Last serviced', owner: 'Owner (zone)', ownerNone: 'Not set',
    toolSet: 'Tool set', size: 'Size', notes: 'Notes', remarks: 'Latest remarks', history: 'History', historyEmpty: 'No history yet',
    edit: 'Edit mould', remove: 'Delete mould', restore: 'Restore mould', deletedBanner: 'This mould is deleted.',
    deleted: (id: string) => `${id} deleted`, restored: (id: string) => `${id} restored`,
    cavities: (n: number | null) => (n == null ? '' : `${n} cav.`), material: 'Material', masterbatch: 'Masterbatch', qas: 'QAS',
    openImage: 'Open picture', noImage: 'No picture yet', addImage: 'Add image', morePictures: (n: number) => `+${n}`, lastMoved: 'Last moved'
  },

  act: {
    outOfService: 'Send out of service', returnToWorkshop: 'Return to Workshop',
    title: 'Move or update',
    mount: 'Mount on a machine', changeMachine: 'Move to another machine', toFloor: 'To Production Floor',
    toMouldRoom: (mr: string) => `Put in ${mr}`, changeRack: 'Change rack', toWorkshop: 'Send to Workshop',
    changeStatus: 'Change status', recordShots: 'Record shots',
    machine: 'Machine', capable: 'Listed for this mould', other: 'Other machines', occupiedBy: (id: string) => `has ${id}`, free: 'free',
    rack: 'Rack', chooseRack: 'Choose a rack', occupancy: (n: number, cap: number | null) => (cap ? `${n}/${cap}` : String(n)),
    status: 'New status', keepStatus: 'Keep current status', remarks: 'Remarks', remarksHint: 'Required for service and repair',
    override: 'Reason for override', overrideHintMachine: 'This machine is not listed for the mould. Admins can override with a reason.',
    overrideHintZone: (owner: string, zone: string) => `This mould belongs to ${owner}, the rack is on the ${zone} side.`,
    shots: 'Shots produced', confirm: 'Confirm', cancel: 'Cancel', saving: 'Saving…',
    moved: (id: string, where: string) => `${id} → ${where}`, statusChanged: (id: string, s: string) => `${id}: ${s}`,
    shotsRecorded: (id: string, n: number) => `${id}: +${n.toLocaleString()} shots`, nothingAllowed: 'You can view this mould but not move it.'
  },

  hist: {
    CREATED: 'Added', IMPORTED: 'Imported from tools list', EDITED: 'Edited', DELETED: 'Deleted', RESTORED: 'Restored', CAVITIES_CHANGED: 'Blocked cavities changed', MOVED: 'Moved', STATUS_CHANGED: 'Status changed',
    moved: (from: string, to: string) => `${from} → ${to}`, status: (from: string, to: string) => `${from} → ${to}`, override: 'Override', by: 'by'
  },

  racks: {
    title: 'Rack view', all: 'All zones', zone: (z: string) => `${z} side`, row: (r: string) => `Row ${r}`, empty: 'Empty', full: 'Full',
    inactive: 'Not in use', waiting: 'Waiting for a rack', waitingHint: 'In the Mould Room but not on a rack yet. Open one and choose a rack.',
    mouldsOn: (code: string) => `Moulds on ${code}`, noMoulds: 'No moulds on this rack.', legendEmpty: 'empty rack', legendUsed: 'in use', legendFull: 'full'
  },

  workshop: {
    title: 'Workshop queue', atWorkshop: 'At the Workshop', flagged: 'Flagged elsewhere (send to Workshop)', none: 'Nothing waiting. 👍',
    since: (when: string) => `since ${when}`
  },

  dispatch: { title: 'Out of Service dispatch', recipientName: 'Recipient / Company name', address: 'Address', repairDetails: 'Repair details', sentAt: 'Sent at', returnedAt: 'Returned at' },
  accessAdmin: {
    roleAccess: 'Role access', userAccess: 'User access', chooseRole: 'Select a role', searchRole: 'Find a role', noRoles: 'No roles found.', builtIn: 'Built-in defaults', resetRole: 'Reset to built-in defaults',
    roleHint: 'Choose access for everyone in this role. Individual custom access takes priority. Reset individual access to role defaults to inherit these settings.',
    noRoleAccess: 'No permissions selected. Users inheriting this role can still sign in and manage their own account.',
    title: 'User access', search: 'Find a user by name or email', choose: 'Select a user',
    hint: 'Choose what this user can view and do. Enable viewing permissions when the user needs to open the related screens.',
    defaults: 'Role defaults', custom: 'Custom access', reset: 'Reset to role defaults',
    none: 'No users found.', retry: 'Try again', noSelection: 'Select a user to manage access.',
    protected: 'System Administrator accounts always have full access and cannot be restricted here.',
    noAccess: 'No permissions selected. This user can still sign in and manage their own account.',
    labels: {
      'mould.view': 'View moulds, search, history and timeline', 'mould.create': 'Add moulds and dies', 'mould.edit': 'Edit mould details, items and cavities',
      'mould.machines.edit': 'Edit capable machines', 'mould.images.manage': 'Add, replace and remove pictures', 'mould.delete': 'Remove and restore moulds',
      'move.machine': 'Mount on a machine', 'move.floor': 'Move to / from the Production Floor', 'move.mouldroom': 'Move into / out of the Mould Room',
      'move.workshop': 'Send to the Workshop', 'move.isolation': 'Send to the Isolation Area', 'move.outOfService': 'Send out of service / return (Super Admin only)',
      'status.change': 'Change status at the Workshop', 'machines.override': 'Override machine compatibility with a reason',
      'worklog.create': 'Record work', 'worklog.view': 'View work history', 'worklog.report': 'Work log report and cavity downtime',
      'problem.report': 'Report problems', 'cavity.manage': 'Run with blocked cavities / restore cavities',
      'rack.view': 'View racks', 'rack.manage': 'Manage zones and racks', 'users.manage': 'Manage users and roles',
      'access.manage': 'Manage access (System Administrator only)', 'import.run': 'Import data', 'audit.view': 'View audit log',
      'export.run': 'Export reports', 'settings.manage': 'Manage system settings'
    } as Record<Permission, string>,
    tabs: { roles: 'Roles', users: 'Users' }, permission: 'Permission', resetDefaults: 'Reset to defaults',
    fromRole: 'from role', granted: 'extra (granted)', denied: 'removed (denied)', notIncluded: 'not included',
    expiry: 'Expires (optional)', reason: 'Reason', reasonHint: 'Required. Saved in the audit log.', reasonRequired: 'Enter a reason (3+ characters).',
    effective: 'Effective permissions', effectiveCount: (n: number) => `${n} permissions`, resetUser: 'Reset this user to role defaults',
    overrides: 'Custom access', expired: 'expired', expires: (d: string) => `until ${d}`, save: 'Save access',
    confirmMatrix: (role: string) => `Change the permissions of every ${role}?`, confirmUser: (name: string) => `Change the access of ${name}?`,
    confirmReset: (name: string) => `Reset ${name} to the role defaults?`, confirmTitle: 'Change access',
    myAccess: 'My access', myAccessHint: 'Only a System Administrator can change access. This is what you can do now.',
    tapToCycle: 'Tap a permission to switch it between role default, extra and removed.'
  },
  machineAdmin: {
    search: 'Search machine code, name or mounted mould', retry: 'Try again', empty: 'No machines found.',
    active: 'Active', inactive: 'Inactive', mould: 'Mounted mould', free: 'None', details: 'View / edit details',
    name: 'Machine name', codeHint: 'Machine code is fixed to preserve mould compatibility records.',
    unmount: 'Take the mould off this machine before disabling it.'
  },
  rackAdmin: {
    title: 'Rack management', readOnly: 'View only — only a Super Admin can change zones and racks.',
    zones: 'Zones', addZone: 'Add zone', code: 'Code', name: 'Name', sortOrder: 'Order', save: 'Save', rename: 'Rename', changeCode: 'Change code',
    disable: 'Disable', enable: 'Enable', disabled: 'Disabled', remove: 'Delete',
    bulk: 'Bulk generate racks', zone: 'Zone', rowFrom: 'Rows from', rowTo: 'to', numFrom: 'Numbers from', numTo: 'to', capacity: 'Capacity',
    capacityHint: 'Leave empty for unlimited', preview: 'Preview', create: (n: number) => `Create ${n} racks`,
    willCreate: (n: number) => `${n} new`, willRevive: (n: number) => `${n} restored`, exist: (n: number) => `${n} already exist`, nothingToDo: 'Nothing to create.',
    created: (n: number) => `${n} racks ready`, addRack: 'Add one rack', row: 'Row', number: 'Number', note: 'Note', active: 'In use',
    editRack: (code: string) => `Rack ${code}`, removeRow: (r: string) => `Delete row ${r}`, unlimited: 'unlimited', saved: 'Saved'
  },

  audit: {
    title: 'Audit log', entity: 'Type', all: 'All', empty: 'No entries.', before: 'Before', after: 'After', reason: 'Reason', more: 'Load more',
    count: (shown: number, total: number) => `${shown} of ${total}`,
    types: { Mould: 'Moulds', Item: 'Items', Rack: 'Racks', Zone: 'Zones', Machine: 'Machines', User: 'Users', Import: 'Imports', Migration: 'Migration' },
    categories: { access: 'Access changes', edits: 'Edits', images: 'Pictures', cavities: 'Cavities' }
  },

  form: {
    add: 'Add mould', edit: 'Edit mould', toolId: 'Tool ID', toolSet: 'Tool set count', size: 'Size', owner: 'Owner (zone)', ownerNone: '— not set —',
    capable: 'Capable machines', capableHint: 'Comma separated, e.g. INJ-03, INJ-04', shotsToService: 'Shots to service', notes: 'Notes',
    startAt: 'Starts at', items: 'Items', itemId: 'Item ID', description: 'Description', cavities: 'Cavities', qas: 'QAS',
    materialId: 'Material ID', materialDescription: 'Material description', masterbatchId: 'Masterbatch ID', masterbatchDescription: 'Masterbatch description',
    addItem: 'Add item', removeItem: 'Remove item', saveItem: 'Save item',
    create: 'Add mould', save: 'Save changes', required: 'Required', added: (id: string) => `${id} added`, saved: (id: string) => `${id} saved`, itemIdRequired: 'Every item needs an Item ID',
    pictures: 'Pictures', picturesHint: (max: number) => `Up to ${max} per item`, addPicture: 'Add picture', takePhoto: 'Camera',
    replacePicture: 'Replace picture', removePicture: 'Remove picture', moveEarlier: 'Move earlier', moveLater: 'Move later',
    picturesPending: (n: number) => `${n} picture(s) will upload after saving`,
    uploadingPictures: (done: number, total: number) => `Uploading pictures ${done}/${total}…`, picturesUploaded: 'Pictures uploaded',
    picturesFailed: (items: string) => `The mould was saved, but some pictures did not upload (${items}). Add them again below.`
  },

  work: {
    log: 'Log work', title: 'Log work', correcting: 'Correcting an earlier entry',
    types: { REPAIR: 'Repair', SERVICE: 'Service', MINOR_FIX: 'Minor fix', INSPECTION: 'Inspection', CLEANING: 'Cleaning', OTHER: 'Other', CAVITY_BLOCK: 'Cavities blocked', CAVITY_RESTORE: 'Cavities restored' } as Record<WorkType, string>,
    type: 'Type of work', what: 'What was done', whatPh: 'e.g. replaced ejector pin, polished cavity 3', who: 'Who did it', whoHint: 'Tap to add or remove a person',
    when: 'When', parts: 'Parts used (optional)', minutes: 'Time spent, minutes (optional)', shots: 'Shot counter (optional)',
    outcome: 'Result', outcomes: { none: 'No change', OK: 'Mould is OK', NEEDS_REPAIR: 'Needs more repair', NEEDS_SERVICE: 'Needs service' },
    sendToWorkshop: 'Send to the Workshop now', stayHint: 'Unticked: it stays where it is and is marked; it can then only go to the Workshop.',
    roomHint: (mr: string) => `A mould in the ${mr} cannot be marked for repair there. It must go to the Workshop.`,
    photos: 'Photos (up to 3)', addPhoto: 'Add photo', removePhoto: 'Remove photo', save: 'Save work log', saving: 'Saving…',
    saved: (id: string) => `Work logged for ${id}`,
    by: (names: string) => `by ${names}`, recordedBy: (n: string) => `recorded by ${n}`,
    last: (type: string, names: string, when: string) => `Last work: ${type} by ${names}, ${when}`,
    minutesShort: (m: number) => `${m} min`, corrected: 'Corrected', correction: 'Correction', correct: 'Correct this entry',
    statusChange: (a: string, b: string) => `Status ${a} → ${b}`, movedToWorkshop: 'Sent to the Workshop',
    warnings: {
      WORKSHOP_MOVE_REQUIRED: 'Saved. The mould is still in the Mould Room — send it to the Workshop to mark it for repair or service.',
      WORKSHOP_MOVE_NOT_ALLOWED: 'Saved. You cannot take a mould out of the Mould Room; ask a Mould Maker to send it to the Workshop.',
      SERVICE_STILL_DUE: 'Saved. The shot limit is still reached, so the status stays until it is serviced.'
    } as Record<string, string>,
    moveNow: 'Send to Workshop now'
  },
  problem: {
    report: 'Report a problem', title: 'Report a problem', what: 'What is wrong', whatPh: 'e.g. flash on part from cavity 2, water leak at core',
    hint: 'This does not move the mould or change its status. A technician or mould maker will act on it.',
    save: 'Send report', saved: (id: string) => `Problem reported for ${id}`, badge: 'Problem reported',
    open: (by: string, when: string) => `Problem reported by ${by}, ${when}`, act: 'Resolve or act', actHint: 'Log the work you did, or send the mould to the Workshop. Either one clears this problem.',
    logWork: 'Log work done', sendToWorkshop: 'Send to Workshop', reportedEntry: 'Problem report', resolvesEntry: 'Resolves problem', filter: 'Problems reported'
  },

  confirm: {
    cancel: 'Cancel', typeToConfirm: (code: string) => `Type ${code} to confirm`,
    moveTitle: 'Move mould', move: (id: string, from: string, to: string) => `Move ${id} from ${from} to ${to}?`, moveBtn: 'Move',
    overrideNote: (reason: string) => `Override — reason: ${reason}`,
    statusTitle: 'Change status', status: (id: string, a: string, b: string) => `Change ${id} from ${a} to ${b}?`, statusBtn: 'Change status',
    workTitle: 'Save work log', work: (id: string, type: string, names: string) => `Save “${type}” on ${id}, done by ${names}?`,
    workCorrection: 'This corrects an earlier entry. The old entry stays in the history, marked as corrected.',
    workMove: 'The mould will also be sent to the Workshop.', workBtn: 'Save',
    problemTitle: 'Report a problem', problem: (id: string) => `Report a problem on ${id}? Its location and status will not change.`, problemBtn: 'Send report',
    deleteMouldTitle: 'Delete mould', deleteMould: (id: string) => `Delete ${id}? It can be restored later and its history is kept.`, reason: 'Reason (optional)', deleteBtn: 'Delete',
    restoreMouldTitle: 'Restore mould', restoreMould: (id: string) => `Restore ${id}? It will appear in searches again.`, restoreBtn: 'Restore',
    removeItemTitle: 'Remove item', removeItem: (item: string, id: string) => `Remove item ${item} from ${id}?`, removeBtn: 'Remove',
    removePictureTitle: 'Remove picture', removePicture: (item: string) => `Remove this picture from item ${item}?`,
    deleteUserTitle: 'Delete user', deleteUser: (n: string) => `Delete ${n}? They will no longer be able to sign in.`,
    roleTitle: 'Change role', role: (n: string, a: string, b: string) => `Change ${n} from ${a} to ${b}?`, roleBtn: 'Change role',
    disableUserTitle: 'Disable user', disableUser: (n: string) => `Disable ${n}? They cannot sign in until enabled again.`, disableBtn: 'Disable',
    enableUserTitle: 'Enable user', enableUser: (n: string) => `Enable ${n}? They can sign in again.`, enableBtn: 'Enable',
    zoneDeleteTitle: 'Delete zone', zoneDelete: (z: string) => `Delete zone ${z} and all its racks? Only possible when every rack is empty.`,
    rackDeleteTitle: 'Delete rack', rackDelete: (code: string) => `Delete rack ${code}? Only possible when it is empty.`,
    rowDeleteTitle: 'Delete row', rowDelete: (z: string, r: string) => `Delete every rack in row ${r} of zone ${z}? Only possible when they are empty.`,
    zoneDisableTitle: 'Disable zone', zoneDisable: (z: string) => `Disable zone ${z}? Its racks cannot take moulds until it is enabled again.`,
    zoneEnableTitle: 'Enable zone', zoneEnable: (z: string) => `Enable zone ${z}? Its racks can take moulds again.`,
    renameZoneTitle: 'Rename zone', renameZone: (z: string) => `Give zone ${z} a new name.`, newName: 'New name',
    codeZoneTitle: 'Change zone code', codeZone: (z: string) => `Change the code of zone ${z}? Its racks (e.g. ${z}-A3) and the owner of its moulds change with it.`, newCode: 'New code', saveBtn: 'Save',
    bulkTitle: 'Create racks', bulk: (n: number, z: string) => `Create ${n} racks in zone ${z}?`, bulkBtn: (n: number) => `Create ${n}`,
    exportTitle: 'Export work log', export: (n: number, fmt: string) => `Export ${n} work log entries as ${fmt}? The export is recorded in the audit log.`, exportBtn: 'Export',
    accountTitle: 'Save account details', account: 'Save the changes to your account?', password: 'Change your password? Use the new one next time you sign in.', accountBtn: 'Save',
    userPassword: (n: string) => `Set a new password for ${n}? They must use it the next time they sign in.`
  },
  feedback: {
    working: 'Working…', moved: 'Moved ✓', saved: 'Saved ✓', deleted: 'Deleted ✓', restored: 'Restored ✓', statusChanged: 'Status changed ✓',
    shots: 'Shots recorded ✓', reported: 'Problem reported ✓', created: 'Created ✓', exported: 'Export ready ✓', removed: 'Removed ✓'
  },

  timeline: { all: 'All', moves: 'Moves', work: 'Work' },
  report: {
    title: 'Work log report', mould: 'Tool ID', person: 'Person', anyone: 'Everyone', type: 'Type', anyType: 'All types',
    from: 'From', to: 'To', machine: 'Machine', exportCsv: 'Export CSV', exportXlsx: 'Export Excel', exporting: 'Preparing file…',
    perPerson: 'Per person', person_: 'Person', total: 'Total', minutes: 'Minutes', repeat: 'Most work in this period (repeat problems)',
    entries: (n: number) => (n === 1 ? '1 entry' : `${n} entries`), none: 'No work logged for this filter.', more: 'Load more', clear: 'Clear filters',
    search: 'Search description, parts, Tool ID, Item ID, machine or person', showing: (shown: number, total: number, range: string) => `Showing ${shown} of ${total} · ${range}`,
    ranges: { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', month: 'This month', all: 'All time', custom: 'Custom' },
    outcome: 'Result', anyOutcome: 'Any result', noOutcome: 'No result given', status: 'Status after', anyStatus: 'Any status', problemOnly: 'Problem reports only',
    clearAll: 'Clear all', remove: 'Remove filter', moreFilters: 'More filters', location: 'Location',
    exportCount: (n: number) => `Export ${n} entries`, exportNone: 'Nothing to export', exportCap: (n: number, cap: number) => `${n} entries match. Exports are limited to ${cap}; narrow the filters or the dates.`
  },

  users: 'Users', addUser: 'Add user', editUser: 'Edit', deleteUser: 'Delete',
  name: 'Name', role: 'Role', active: 'Active', disabled: 'Disabled', userSaved: 'User saved', userAdded: 'User added', userDeleted: 'User deleted',

  signIn: 'Sign in', signingIn: 'Signing in…', email: 'Email', password: 'Password', signOut: 'Sign out', loginSub: 'Sign in to see where every mould is.',
  accountTitle: 'Account details', mustChangePassword: 'Choose a new password before you continue. Enter your current password and a new one below.', accountSaved: 'Account details updated', keepPassword: 'Leave new password blank to keep your current password.',
  currentPassword: 'Current password', newPassword: 'New password (min 8 characters)', repeatPassword: 'Repeat new password',
  pwMismatch: 'The two new passwords do not match', saveBtn: 'Save changes', close: 'Close', cancel: 'Cancel', loading: 'Loading…', reload: 'Reload',
  install: {
    button: 'Install app', ios: 'In Safari, choose Share → Add to Home Screen. Keep Open as Web App on if shown, then choose Add.',
    other: 'Use Chrome or Edge on Android/Windows and choose Install app from the menu. In Mac Safari, choose File → Add to Dock.',
    guide: 'Device setup and installation guide'
  },

  offlineError: 'Cannot reach the server. Check that the backend is running.',
  errors: {
    NOT_GOOD: (d: D) => `This mould is ${String(d.status ?? '').toLowerCase().replace(/_/g, ' ')}; it can only go to the Workshop.`,
    MACHINE_REQUIRED: () => 'Choose a machine.',
    MACHINE_INACTIVE: () => 'That machine is not in use.',
    NO_CHANGE: () => 'Nothing to change — it is already there.',
    SERVICE_DUE: () => 'This mould has reached its shot limit. Send it to the Workshop for service.',
    MACHINE_OCCUPIED: (d: D) => `That machine already has ${d.occupant ?? 'a mould'}. Take it off first.`,
    NOT_CAPABLE: (d: D) => `This mould is not listed for that machine${Array.isArray(d.capableMachines) && d.capableMachines.length ? ` (listed: ${d.capableMachines.join(', ')})` : ''}. Ask an Admin to override.`,
    OVERRIDE_REASON_REQUIRED: () => 'This machine is not listed for the mould. Give a reason to override.',
    RACK_REQUIRED: () => 'Choose a rack.',
    RACK_INACTIVE: () => 'That rack is not in use.',
    RACK_FULL: () => 'That rack is full.',
    OWNER_MISMATCH: (d: D) => `This mould belongs to ${d.owner}, not ${d.zone}. Give a reason to use this rack.`,
    REMARKS_REQUIRED: () => 'Remarks are required for service and repair.',
    STATUS_ONLY_AT_WORKSHOP: () => 'A status can only be set at the Workshop.',
    NOT_AT_WORKSHOP: () => 'Send the mould to the Workshop before changing its status.',
    NOT_ON_MACHINE: () => 'Shots can only be recorded while the mould is on a machine.',
    INVALID_SHOTS: () => 'Shots must be a whole number above zero.',
    FORBIDDEN_MOVE: () => 'You do not have permission to make this move.',
    FORBIDDEN: () => 'You do not have permission to do this.',
    MOULD_DELETED: () => 'This mould is deleted.',
    STALE: () => 'Someone else changed this just now. It has been refreshed — try again.',
    DUPLICATE_TOOL_ID: () => 'That Tool ID already exists.',
    DUPLICATE: () => 'That already exists.',
    UNMOUNT_FIRST: () => 'Take the mould off the machine first.',
    RACK_OCCUPIED: (d: D) => `Move the moulds off ${Array.isArray(d.racks) ? d.racks.join(', ') : 'the rack'} first.`,
    NOT_FOUND: () => 'Not found. It may have been removed.',
    INVALID_RANGE: () => 'Check the rows and numbers.',
    INVALID_LOCATION: () => 'That location is not allowed here.',
    INVALID_STATUS: () => 'Unknown status.',
    GONE: () => 'This screen is out of date. Reload the app.',
    DESCRIPTION_REQUIRED: () => 'Say what was done.',
    TOO_MANY_WORKERS: () => 'Up to five people per entry.',
    INVALID_WORKER: () => 'Choose people who are allowed to do mould work.',
    INVALID_DATE: () => 'Check the date and time.',
    DONE_AT_FUTURE: () => 'The work time cannot be in the future.',
    INVALID_CORRECTION: () => 'The entry being corrected was not found.',
    INVALID_PHOTO: () => 'Photos must be JPEG, PNG or WebP pictures.',
    ISOLATION_FIRST: () => 'Send to Isolation Area first.',
    INVALID_DESTINATION: () => 'A planned destination can only be given when sending to the Isolation Area.',
    USE_CAVITY_ACTION: () => 'Use "Run with blocked cavities" for that.',
    LAST_SYSTEM_ADMIN: () => 'There must always be at least one active System Administrator.',
    STALE_ACCESS: () => 'Someone else changed this access meanwhile. Reload and try again.',
    PASSWORD_CHANGE_REQUIRED: () => 'Change your password first.',
    ROLE_LOCKED: () => 'System Administrator access is always everything.',
    SUPER_ADMIN_ONLY: () => 'Out of Service access is reserved for Super Admins.',
    INVALID_EXPIRY: () => 'The expiry must be in the future.',
    TOO_MANY_IMAGES: () => 'This item already has the maximum number of pictures.',
    DUPLICATE_IMAGE: () => 'This picture is already on the item.',
    INVALID_ORDER: () => 'The pictures changed meanwhile. Reopen the form and try again.',
    TOO_LARGE: () => 'The photos are too large. Use fewer or smaller photos.',
    EXPORT_TOO_LARGE: (d: D) => `${d.total} entries match. Exports are limited to ${d.cap}; narrow the filters or the dates.`
  } satisfies Record<string, (d: D) => string>
};

export type Dict = typeof en;

const si: Dict = {
  rackLayout: {
    title: 'Mould ගබඩා කිරීම සහ හඳුනාගැනීම', format: 'Location ආකෘතිය', formatHint: 'Rack – Pallet / තට්ටුව – ස්ථානය',
    layout: 'ගබඩා rack සැලැස්ම', rack: 'Rack', pallet: 'Pallet / තට්ටුව', position: 'ස්ථානය', legacy: 'පැරණි locations',
    search: 'Mould එකක් හෝ location එකක් සොයන්න', searchHint: 'Mould ID, Product ID, විස්තරය හෝ A-P1-1',
    positions: 'ස්ථාන', noPositions: 'තවම ගබඩා ස්ථාන නැහැ.', table: 'Mould location වගුව', showAll: 'සියල්ල පෙන්වන්න',
    mould: 'Mould ID', product: 'Product ID', description: 'විස්තරය', location: 'Location', cavities: 'Cavities', machine: 'Machine / ප්‍රමාණය',
    noResults: 'මෙම තේරීමට ගැළපෙන moulds නැහැ.', palletFrom: 'Pallet / තට්ටුව සිට', palletTo: 'Pallet / තට්ටුව දක්වා',
  },
  themeLight: 'Light theme එකට මාරු කරන්න',
  themeDark: 'Dark theme එකට මාරු කරන්න',
  toolType: 'Tool වර්ගය',
  toolTypes: { INJECTION_MOULD: 'Injection Moulds', EXTRUSION_DIE: 'Extrusion Die Tools' },
  extrusionResults: (n: number) => `Extrusion die tools ${n}`,
  extrusionEmpty: 'Extrusion die tools හමු වුණේ නැහැ.',
  extrusionSearch: 'Die ID, Pin ID, Item ID, විස්තරය හෝ මැෂිම',
  extrusionAdd: 'Extrusion die tool එකතු කරන්න',
  extrusionShort: 'Extrusion',
  extrusionEdit: 'Extrusion die tool වෙනස් කරන්න',
  mouldRoom: 'Mould කාමරය',
  brandTitle: 'Mould සෙවුම',
  brandSub: 'ඕනෑම mould එකක් තත්පර කිහිපයකින් සොයන්න',
  loc: { MACHINE: 'මැෂිම', PRODUCTION_FLOOR: 'Production Floor', ISOLATION: 'Isolation කලාපය', WORKSHOP: 'Workshop', TOOL_ROOM: 'Tool Room', OUT_OF_SERVICE: 'Out of Service' },
  status: { GOOD: 'හොඳ තත්ත්වයේ', NEEDS_SERVICE: 'Service කළ යුතුයි', NEEDS_REPAIR: 'අලුත්වැඩියා කළ යුතුයි', IN_SERVICE: 'Service වෙමින්', IN_REPAIR: 'අලුත්වැඩියා වෙමින්', RUNNING_LIMITED: 'Run වෙනවා – අලුත්වැඩියා කළ යුතුයි' },
  isolation: {
    title: 'Isolation කලාපය', hint: 'Production Floor, Mould කාමරය සහ Workshop අතර රැඳී සිටින moulds. Machine එකකින් අවසන් නොවන හැම ගෙනයාමක්ම මෙතනින් යනවා.',
    empty: 'Isolation කලාපයේ කිසිවක් රැඳී නැහැ.', send: 'Isolation කලාපයට යවන්න', moveOn: 'ඉදිරියට ගෙනයන්න', plannedFor: 'යන්න බලාපොරොත්තු තැන', notDecided: 'තවම තීරණය කර නැහැ',
    choosePlan: 'ඊළඟට යා යුත්තේ කොහෙටද? (අත්‍යවශ්‍ය නැහැ)', setStatus: 'Status (අත්‍යවශ්‍ය නැහැ)', waiting: (d) => `${d} ක් රැඳී සිටී`, waitingFor: (d) => `${d} ක් රැඳී සිටී`,
    tooLong: 'ඕනෑවට වඩා වෙලා රැඳී සිටී', tooLongCount: (n) => `${n}ක් ඕනෑවට වඩා වෙලා රැඳී සිටී`, stayed: (d) => `Isolation එකේ ${d} ක් සිටියා`, from: 'ආවේ'
  },
  dashboard: {
    title: 'Dashboard', hint: 'හැම mould එකක්ම තියෙන තැන, අවධානය ඕනෑ දේ සහ මේ මාසයේ කළ වැඩ.',
    byLocation: 'තැන අනුව', byStatus: 'Status අනුව', limited: 'Cavities වසා run වෙන', isolationTooLong: 'Isolation එකේ ඕනෑවට වඩා රැඳී සිටින',
    serviceDue: 'Shots අනුව service කළ යුතු', workThisMonth: 'මේ මාසයේ කළ වැඩ', entries: (n) => `සටහන් ${n}`, none: 'නැත', total: (n) => `moulds ${n}`
  },
  cavity: {
    action: 'Cavities වසා run කරන්න', change: 'වසා ඇති cavities වෙනස් කරන්න', title: 'Cavities වසා run කරන්න',
    hint: 'Cavities කිහිපයක් වසා මේ mould එක නිෂ්පාදනයේ දිගටම run කරනවා. වසා ඇති cavities tap කරන්න.',
    noCavities: 'මුලින්ම items වල cavities ගණන ඇතුළත් කරන්න.', reason: 'හේතුව', reasonRequired: 'හේතුවක් අනිවාර්යයි.',
    problemType: 'ගැටලුවේ වර්ගය (අත්‍යවශ්‍ය නැහැ)', photo: 'පින්තූරය (අත්‍යවශ්‍ය නැහැ)', expectedFix: 'සකස් කරන්න බලාපොරොත්තු දිනය (අත්‍යවශ්‍ය නැහැ)',
    summary: (active, total) => `cavities ${total}න් ${active}ක් ක්‍රියාත්මකයි`, badge: (active, total, d) => `cavities ${active}/${total}${d ? ` · ${d} සිට` : ''}`,
    restoreAll: 'සියලු cavities නැවත විවෘත කරන්න', confirmTitle: 'වසා ඇති cavities', confirm: (tool, active, total) => `${tool}: cavities ${total}න් ${active}ක් ක්‍රියාත්මකයි. Save කරන්නද?`,
    confirmRestore: (tool) => `${tool} හි සියලු cavities නැවත විවෘත කරන්නද? එය නැවත හොඳ තත්ත්වයට එනවා.`, saved: 'Cavities save කළා', restored: 'සියලු cavities නැවත විවෘත කළා',
    filter: 'Cavities වසා run වෙන', queue: 'අලුත්වැඩියා කළ යුතු නමුත් run වෙන', tooLong: 'ඕනෑවට වඩා කාලයක් සීමිතව run වෙනවා',
    downtime: 'Cavity downtime', downtimeEmpty: 'කිසිදු cavity එකක් වසා නැහැ.', period: 'කාලය', which: 'වසා ඇති cavities', open: 'තවම වසා ඇත', decidedBy: 'තීරණය කළේ', expectedBy: (d) => `${d} වන විට සකස් කිරීමට බලාපොරොත්තුයි`
  },
  duration: (days, hours, minutes) => (days ? `දින ${days} පැය ${hours}` : hours ? `පැය ${hours} මි. ${minutes}` : `මි. ${minutes}`),
  roles: { system_admin: 'System Administrator', super_admin: 'Super Admin', admin: 'Admin', production_supervisor: 'නිෂ්පාදන අධීක්ෂක', mould_technician: 'Mould තාක්ෂණ ශිල්පී', mould_maker: 'Mould සාදන්නා', executive: 'විධායක' },
  rolesHelp: 'Super Admin: සියල්ල • Admin: moulds සහ users • නිෂ්පාදන අධීක්ෂක: මැෂින් වෙනස් කිරීම් • Mould තාක්ෂණ ශිල්පී: මැෂින් වෙනස් කිරීම්, service සහ අලුත්වැඩියා • Mould සාදන්නා: Mould කාමරය, service සහ අලුත්වැඩියා',

  nav: {
    documentation: 'භාවිත උපදෙස්',
    find: 'Mould එකක් සොයන්න', racks: 'Racks බලන්න', workshop: 'Workshop පෝලිම', admin: 'Admin', superAdmin: 'Super Admin',
    machines: 'මැෂින්', users: 'Users', rackAdmin: 'Racks කළමනාකරණය', audit: 'Audit සටහන්', workReport: 'වැඩ සටහන් වාර්තාව', account: 'ගිණුම් විස්තර', menu: 'මෙනුව', closeMenu: 'මෙනුව වහන්න',
    language: 'භාෂාව', findShort: 'සොයන්න', racksShort: 'Racks', workshopShort: 'Workshop', more: 'තවත්', expand: 'මෙනුව විහිදන්න', collapse: 'මෙනුව හකුළන්න', accountMenu: 'ගිණුම සහ මෙනුව'
  },
  sync: { syncing: 'Sync වෙමින්…', synced: 'Server එකත් එක්ක sync වෙලා', offline: 'Offline — server එකට සම්බන්ධ වෙන්න බෑ' },

  search: {
    placeholder: 'Tool ID, Item ID, විස්තරය, මැෂිම හෝ rack එක',
    clear: 'සෙවුම මකන්න',
    results: (n) => `moulds ${n}`,
    allMoulds: 'සියලුම moulds',
    noMatch: 'සෙවුමට ගැලපෙන mould එකක් නෑ.',
    empty: 'තවම moulds නෑ.'
  },
  dash: { total: 'සියල්ල', attention: 'Service / අලුත්වැඩියා', awaitingRack: 'තවම rack නෑ', filterOn: 'පෙරහන', clearFilter: 'සියල්ල පෙන්වන්න' },

  card: {
    moved: (when, who) => (who ? `${when} · ${who} ගෙනගියා` : `${when} ගෙනගියා`),
    items: (n) => `items ${n}`,
    noRack: 'තවම rack නෑ',
    shotsDue: 'Service කාලයයි'
  },

  detail: {
    items: 'මේ mould එකෙන් හදන items', noItems: 'Items සඳහන් කර නෑ.', capableMachines: 'යොදන්න පුළුවන් මැෂින්', none: 'සඳහන් කර නෑ',
    shots: 'Shots', shotsOf: (a, b) => (b ? `${a.toLocaleString()} / ${b.toLocaleString()}` : a.toLocaleString()),
    serviceDue: 'Shot සීමාව ඉක්මවලා — service කළ යුතුයි', lastServiced: 'අවසන් service එක', owner: 'අයිතිය (zone)', ownerNone: 'සඳහන් කර නෑ',
    toolSet: 'Tool set', size: 'ප්‍රමාණය', notes: 'සටහන්', remarks: 'අවසන් සටහන', history: 'ඉතිහාසය', historyEmpty: 'තවම ඉතිහාසයක් නෑ',
    edit: 'Mould එක සංස්කරණය', remove: 'Mould එක මකන්න', restore: 'Mould එක නැවත ගන්න', deletedBanner: 'මේ mould එක මකා දමා ඇත.',
    deleted: (id) => `${id} මකා දැමුවා`, restored: (id) => `${id} නැවත ගත්තා`,
    cavities: (n) => (n == null ? '' : `cavities ${n}`), material: 'Material', masterbatch: 'Masterbatch', qas: 'QAS',
    openImage: 'පින්තූරය විවෘත කරන්න', noImage: 'තවම පින්තූරයක් නෑ', addImage: 'පින්තූරයක් එකතු කරන්න', morePictures: (n) => `+${n}`, lastMoved: 'අවසන් වරට ගෙනගියේ'
  },

  act: {
    outOfService: 'Send out of service', returnToWorkshop: 'Return to Workshop',
    title: 'ගෙනයන්න හෝ යාවත්කාලීන කරන්න',
    mount: 'මැෂිමකට දාන්න', changeMachine: 'වෙනත් මැෂිමකට දාන්න', toFloor: 'Production Floor එකට',
    toMouldRoom: (mr) => `${mr}ට දාන්න`, changeRack: 'Rack එක වෙනස් කරන්න', toWorkshop: 'Workshop එකට යවන්න',
    changeStatus: 'තත්ත්වය වෙනස් කරන්න', recordShots: 'Shots සටහන් කරන්න',
    machine: 'මැෂිම', capable: 'මේ mould එකට සඳහන් මැෂින්', other: 'වෙනත් මැෂින්', occupiedBy: (id) => `${id} තියෙනවා`, free: 'හිස්',
    rack: 'Rack', chooseRack: 'Rack එකක් තෝරන්න', occupancy: (n, cap) => (cap ? `${n}/${cap}` : String(n)),
    status: 'අලුත් තත්ත්වය', keepStatus: 'දැන් තත්ත්වයම තියන්න', remarks: 'සටහන', remarksHint: 'Service සහ අලුත්වැඩියාවට අනිවාර්යයි',
    override: 'Override කිරීමට හේතුව', overrideHintMachine: 'මේ මැෂිම mould එකට සඳහන් කර නෑ. Admin කෙනෙකුට හේතුවක් දී override කරන්න පුළුවන්.',
    overrideHintZone: (owner, zone) => `මේ mould එක ${owner} එකේ; rack එක ${zone} පැත්තේ.`,
    shots: 'නිපදවූ shots', confirm: 'තහවුරු කරන්න', cancel: 'අවලංගු කරන්න', saving: 'Save වෙමින්…',
    moved: (id, where) => `${id} → ${where}`, statusChanged: (id, s) => `${id}: ${s}`,
    shotsRecorded: (id, n) => `${id}: shots +${n.toLocaleString()}`, nothingAllowed: 'ඔබට මේ mould එක බලන්න පුළුවන්, ගෙනයන්න බෑ.'
  },

  hist: {
    CREATED: 'එකතු කළා', IMPORTED: 'Tools list එකෙන් ගත්තා', EDITED: 'සංස්කරණය කළා', DELETED: 'මකා දැමුවා', RESTORED: 'නැවත ගත්තා', CAVITIES_CHANGED: 'වසා ඇති cavities වෙනස් කළා', MOVED: 'ගෙනගියා', STATUS_CHANGED: 'Status වෙනස් කළා',
    moved: (from, to) => `${from} → ${to}`, status: (from, to) => `${from} → ${to}`, override: 'Override', by: ''
  },

  racks: {
    title: 'Racks බලන්න', all: 'සියලු zones', zone: (z) => `${z} පැත්ත`, row: (r) => `${r} පේළිය`, empty: 'හිස්', full: 'පිරිලා',
    inactive: 'භාවිතයේ නෑ', waiting: 'Rack එකක් බලාපොරොත්තුවෙන්', waitingHint: 'Mould කාමරයේ තියෙනවා, තවම rack එකක් නෑ. එකක් විවෘත කරලා rack එකක් තෝරන්න.',
    mouldsOn: (code) => `${code} එකේ moulds`, noMoulds: 'මේ rack එකේ moulds නෑ.', legendEmpty: 'හිස් rack', legendUsed: 'භාවිතයේ', legendFull: 'පිරිලා'
  },

  workshop: {
    title: 'Workshop පෝලිම', atWorkshop: 'Workshop එකේ', flagged: 'වෙනත් තැනක සලකුණු කළ (Workshop එකට යවන්න)', none: 'බලාගෙන ඉන්න කිසිවක් නෑ. 👍',
    since: (when) => `${when} සිට`
  },

  dispatch: { title: 'Out of Service යැවූ විස්තර', recipientName: 'ලබන්නාගේ / ආයතනයේ නම', address: 'ලිපිනය', repairDetails: 'අලුත්වැඩියා විස්තර', sentAt: 'යැවූ දිනය', returnedAt: 'නැවත ලැබුණු දිනය' },
  accessAdmin: {
    roleAccess: 'Role access', userAccess: 'User access', chooseRole: 'Role එකක් තෝරන්න', searchRole: 'Role එකක් සොයන්න', noRoles: 'Roles හමු නොවුණි.', builtIn: 'මුල් අවසර', resetRole: 'මුල් අවසර වෙත යළි සකසන්න',
    roleHint: 'මෙම role එකේ සියලු users සඳහා access තෝරන්න. User කෙනෙකුගේ custom access එකට ප්‍රමුඛතාව ලැබේ. Role access ලබාගැනීමට එම userගේ access role defaults වෙත යළි සකසන්න.',
    noRoleAccess: 'අවසර තෝරා නැත. මෙම role එකේ අවසර භාවිත කරන usersට login වී තම account එක කළමනාකරණය කළ හැක.',
    title: 'User access පාලනය', search: 'නම හෝ email එකෙන් user සොයන්න', choose: 'User කෙනෙක් තෝරන්න',
    hint: 'මේ userට බලන්න සහ කරන්න පුළුවන් දේ තෝරන්න. අදාළ pages විවෘත කිරීමට view permissions ද ලබා දෙන්න.',
    defaults: 'Role එකේ සාමාන්‍ය access', custom: 'වෙනම සකස් කළ access', reset: 'Role එකේ සාමාන්‍ය access නැවත යොදන්න',
    none: 'Users හමු වුණේ නැහැ.', retry: 'නැවත උත්සාහ කරන්න', noSelection: 'Access සකස් කිරීමට user කෙනෙක් තෝරන්න.',
    protected: 'System Administratorට සැමවිටම සම්පූර්ණ access ඇත. එම accounts මෙතැනින් සීමා කළ නොහැක.',
    noAccess: 'Permissions තෝරා නැහැ. මේ userට sign in වී තමන්ගේ account එක පාලනය කරන්න තවමත් පුළුවන්.',
    labels: {
      'mould.view': 'Moulds, සෙවීම, ඉතිහාසය සහ timeline බලන්න', 'mould.create': 'Moulds සහ dies එකතු කරන්න', 'mould.edit': 'Mould විස්තර, items සහ cavities සංස්කරණය',
      'mould.machines.edit': 'යොදන්න පුළුවන් machines සංස්කරණය', 'mould.images.manage': 'පින්තූර එකතු කිරීම, මාරු කිරීම, ඉවත් කිරීම', 'mould.delete': 'Moulds ඉවත් කිරීම සහ නැවත ගැනීම',
      'move.machine': 'Machine එකකට සවි කරන්න', 'move.floor': 'Production Floor එකට / එකෙන් ගෙනයන්න', 'move.mouldroom': 'Mould කාමරයට / කාමරයෙන් ගෙනයන්න',
      'move.workshop': 'Workshop එකට යවන්න', 'move.isolation': 'Isolation කලාපයට යවන්න', 'move.outOfService': 'Out of service යැවීම / ආපසු ගැනීම (Super Admin පමණයි)',
      'status.change': 'Workshop එකේදී status වෙනස් කරන්න', 'machines.override': 'හේතුවක් දී machine compatibility override කරන්න',
      'worklog.create': 'වැඩ සටහන් කරන්න', 'worklog.view': 'වැඩ ඉතිහාසය බලන්න', 'worklog.report': 'වැඩ වාර්තාව සහ cavity downtime',
      'problem.report': 'ගැටලු වාර්තා කරන්න', 'cavity.manage': 'Cavities වසා run කිරීම / cavities නැවත විවෘත කිරීම',
      'rack.view': 'Racks බලන්න', 'rack.manage': 'Zones සහ racks පාලනය කරන්න', 'users.manage': 'Users සහ roles පාලනය කරන්න',
      'access.manage': 'Access පාලනය (System Administrator පමණයි)', 'import.run': 'Data import කරන්න', 'audit.view': 'Audit සටහන් බලන්න',
      'export.run': 'වාර්තා export කරන්න', 'settings.manage': 'System settings වෙනස් කරන්න'
    },
    tabs: { roles: 'Roles', users: 'Users' }, permission: 'අවසරය', resetDefaults: 'මුල් අවසර වෙත යළි සකසන්න',
    fromRole: 'role එකෙන්', granted: 'අමතර (ලබා දුන්)', denied: 'ඉවත් කළ', notIncluded: 'නැත',
    expiry: 'කල් ඉකුත් වන දිනය (අත්‍යවශ්‍ය නැත)', reason: 'හේතුව', reasonHint: 'අනිවාර්යයි. Audit සටහනේ save වෙනවා.', reasonRequired: 'හේතුවක් ලියන්න (අකුරු 3+).',
    effective: 'දැනට ඇති අවසර', effectiveCount: (n) => `අවසර ${n}`, resetUser: 'මේ user role එකේ මුල් අවසර වෙත යළි සකසන්න',
    overrides: 'වෙනම access', expired: 'කල් ඉකුත්', expires: (d) => `${d} දක්වා`, save: 'Access save කරන්න',
    confirmMatrix: (role) => `හැම ${role} කෙනෙකුගේම අවසර වෙනස් කරන්නද?`, confirmUser: (name) => `${name}ගේ access වෙනස් කරන්නද?`,
    confirmReset: (name) => `${name} role එකේ මුල් අවසර වෙත යළි සකසන්නද?`, confirmTitle: 'Access වෙනස් කිරීම',
    myAccess: 'මගේ access', myAccessHint: 'Access වෙනස් කළ හැක්කේ System Administratorට පමණයි. මේ ඔබට දැන් කළ හැකි දේ.',
    tapToCycle: 'අවසරයක් tap කර role default, අමතර සහ ඉවත් කළ අතර මාරු කරන්න.'
  },
  machineAdmin: {
    search: 'Machine code, නම හෝ mounted mould සොයන්න', retry: 'නැවත උත්සාහ කරන්න', empty: 'මැෂින් හමු වුණේ නෑ.',
    active: 'සක්‍රියයි', inactive: 'අක්‍රියයි', mould: 'සවි කර ඇති mould', free: 'නැත', details: 'විස්තර බලන්න / වෙනස් කරන්න',
    name: 'මැෂිමේ නම', codeHint: 'Mould compatibility සටහන් රැකීමට machine code එක වෙනස් කළ නොහැක.',
    unmount: 'මැෂිම අක්‍රිය කිරීමට පෙර mould එක ඉවත් කරන්න.'
  },
  rackAdmin: {
    title: 'Racks කළමනාකරණය', readOnly: 'බලන්න පමණයි — zones සහ racks වෙනස් කරන්න පුළුවන් Super Admin ට පමණයි.',
    zones: 'Zones', addZone: 'Zone එකක් එකතු කරන්න', code: 'කේතය', name: 'නම', sortOrder: 'අනුපිළිවෙල', save: 'Save කරන්න', rename: 'නම වෙනස් කරන්න', changeCode: 'කේතය වෙනස් කරන්න',
    disable: 'අක්‍රිය කරන්න', enable: 'සක්‍රිය කරන්න', disabled: 'අක්‍රියයි', remove: 'මකන්න',
    bulk: 'Racks එකවර හදන්න', zone: 'Zone', rowFrom: 'පේළි', rowTo: 'සිට', numFrom: 'අංක', numTo: 'දක්වා', capacity: 'ධාරිතාව',
    capacityHint: 'සීමාවක් නැත්නම් හිස්ව තබන්න', preview: 'පෙරදසුන', create: (n) => `Racks ${n}ක් හදන්න`,
    willCreate: (n) => `අලුත් ${n}`, willRevive: (n) => `නැවත ගන්නා ${n}`, exist: (n) => `දැනටමත් ${n}ක් තියෙනවා`, nothingToDo: 'හදන්න දෙයක් නෑ.',
    created: (n) => `Racks ${n}ක් සූදානම්`, addRack: 'එක rack එකක් එකතු කරන්න', row: 'පේළිය', number: 'අංකය', note: 'සටහන', active: 'භාවිතයේ',
    editRack: (code) => `Rack ${code}`, removeRow: (r) => `${r} පේළිය මකන්න`, unlimited: 'සීමාවක් නෑ', saved: 'Save කළා'
  },

  audit: {
    title: 'Audit සටහන්', entity: 'වර්ගය', all: 'සියල්ල', empty: 'සටහන් නෑ.', before: 'කලින්', after: 'පසුව', reason: 'හේතුව', more: 'තවත් පෙන්වන්න',
    count: (shown, total) => `${total} න් ${shown}`,
    types: { Mould: 'Moulds', Item: 'Items', Rack: 'Racks', Zone: 'Zones', Machine: 'මැෂින්', User: 'Users', Import: 'Import', Migration: 'Migration' },
    categories: { access: 'Access වෙනස්කම්', edits: 'සංස්කරණ', images: 'පින්තූර', cavities: 'Cavities' }
  },

  form: {
    add: 'Mould එකක් එකතු කරන්න', edit: 'Mould එක සංස්කරණය', toolId: 'Tool ID', toolSet: 'Tool set ගණන', size: 'ප්‍රමාණය', owner: 'අයිතිය (zone)', ownerNone: '— සඳහන් කර නෑ —',
    capable: 'යොදන්න පුළුවන් මැෂින්', capableHint: 'කොමා වලින් වෙන් කරන්න, උදා: INJ-03, INJ-04', shotsToService: 'Service වෙන්න ඕන shots', notes: 'සටහන්',
    startAt: 'ආරම්භක තැන', items: 'Items', itemId: 'Item ID', description: 'විස්තරය', cavities: 'Cavities', qas: 'QAS',
    materialId: 'Material ID', materialDescription: 'Material විස්තරය', masterbatchId: 'Masterbatch ID', masterbatchDescription: 'Masterbatch විස්තරය',
    addItem: 'Item එකක් එකතු කරන්න', removeItem: 'Item එක ඉවත් කරන්න', saveItem: 'Item එක save කරන්න',
    create: 'Mould එක එකතු කරන්න', save: 'වෙනස්කම් save කරන්න', required: 'අනිවාර්යයි', added: (id) => `${id} එකතු කළා`, saved: (id) => `${id} save කළා`, itemIdRequired: 'හැම item එකකටම Item ID එකක් ඕනේ',
    pictures: 'පින්තූර', picturesHint: (max) => `item එකකට ${max}ක් දක්වා`, addPicture: 'පින්තූරයක් එකතු කරන්න', takePhoto: 'කැමරාව',
    replacePicture: 'පින්තූරය මාරු කරන්න', removePicture: 'පින්තූරය ඉවත් කරන්න', moveEarlier: 'ඉස්සරහට', moveLater: 'පස්සට',
    picturesPending: (n) => `save කළාම පින්තූර ${n}ක් upload වෙනවා`,
    uploadingPictures: (done, total) => `පින්තූර upload වෙමින් ${done}/${total}…`, picturesUploaded: 'පින්තූර upload කළා',
    picturesFailed: (items) => `Mould එක save වුණා, නමුත් පින්තූර කිහිපයක් upload වුණේ නෑ (${items}). පහළින් ආයෙත් එකතු කරන්න.`
  },

  work: {
    log: 'වැඩ සටහන් කරන්න', title: 'වැඩ සටහන් කරන්න', correcting: 'කලින් සටහනක් නිවැරදි කරනවා',
    types: { REPAIR: 'අලුත්වැඩියාව', SERVICE: 'Service', MINOR_FIX: 'සුළු සකස් කිරීම', INSPECTION: 'පරීක්ෂාව', CLEANING: 'පිරිසිදු කිරීම', OTHER: 'වෙනත්', CAVITY_BLOCK: 'Cavities වසා දැමුවා', CAVITY_RESTORE: 'Cavities නැවත විවෘත කළා' },
    type: 'වැඩේ වර්ගය', what: 'කළේ මොකක්ද', whatPh: 'උදා: ejector pin එක මාරු කළා, cavity 3 polish කළා', who: 'කළේ කවුද', whoHint: 'කෙනෙක් එකතු කරන්න හෝ ඉවත් කරන්න තට්ටු කරන්න',
    when: 'කවදාද', parts: 'පාවිච්චි කළ කොටස් (විකල්පයි)', minutes: 'ගතවූ කාලය, මිනිත්තු (විකල්පයි)', shots: 'Shot ගණන (විකල්පයි)',
    outcome: 'ප්‍රතිඵලය', outcomes: { none: 'වෙනසක් නෑ', OK: 'Mould එක හොඳයි', NEEDS_REPAIR: 'තවත් අලුත්වැඩියා ඕනේ', NEEDS_SERVICE: 'Service ඕනේ' },
    sendToWorkshop: 'දැන්ම Workshop එකට යවන්න', stayHint: 'Tick නොකළොත්: තියෙන තැනම සලකුණු වෙනවා; ඊට පස්සේ යවන්න පුළුවන් Workshop එකට පමණයි.',
    roomHint: (mr) => `${mr}ේ තියෙන mould එකක් එතනදී අලුත්වැඩියාවට සලකුණු කරන්න බෑ. Workshop එකට යවන්න ඕනේ.`,
    photos: 'පින්තූර (3ක් දක්වා)', addPhoto: 'පින්තූරයක් එකතු කරන්න', removePhoto: 'පින්තූරය ඉවත් කරන්න', save: 'වැඩ සටහන save කරන්න', saving: 'Save වෙමින්…',
    saved: (id) => `${id} සඳහා වැඩ සටහන් කළා`,
    by: (names) => `${names} විසින්`, recordedBy: (n) => `සටහන් කළේ ${n}`,
    last: (type, names, when) => `අවසන් වැඩේ: ${type} — ${names}, ${when}`,
    minutesShort: (m) => `මිනිත්තු ${m}`, corrected: 'නිවැරදි කළා', correction: 'නිවැරදි කිරීම', correct: 'මේ සටහන නිවැරදි කරන්න',
    statusChange: (a, b) => `තත්ත්වය ${a} → ${b}`, movedToWorkshop: 'Workshop එකට යැව්වා',
    warnings: {
      WORKSHOP_MOVE_REQUIRED: 'Save කළා. Mould එක තවම Mould කාමරයේ — අලුත්වැඩියා/service සඳහා සලකුණු කරන්න Workshop එකට යවන්න.',
      WORKSHOP_MOVE_NOT_ALLOWED: 'Save කළා. Mould කාමරයෙන් mould එකක් ගන්න ඔබට අවසර නෑ; Workshop එකට යවන්න Mould සාදන්නෙක්ගෙන් ඉල්ලන්න.',
      SERVICE_STILL_DUE: 'Save කළා. Shot සීමාව තවම ඉක්මවලා, service කරන තුරු තත්ත්වය එහෙමමයි.'
    },
    moveNow: 'දැන්ම Workshop එකට යවන්න'
  },
  problem: {
    report: 'ගැටලුවක් වාර්තා කරන්න', title: 'ගැටලුවක් වාර්තා කරන්න', what: 'මොකක්ද වැරැද්ද', whatPh: 'උදා: cavity 2 කොටසේ flash, core එකේ වතුර කාන්දුව',
    hint: 'මෙයින් mould එක ගෙනයන්නේවත් තත්ත්වය වෙනස් කරන්නේවත් නෑ. තාක්ෂණ ශිල්පියෙක් හෝ mould සාදන්නෙක් ක්‍රියා කරයි.',
    save: 'වාර්තාව යවන්න', saved: (id) => `${id} සඳහා ගැටලුව වාර්තා කළා`, badge: 'ගැටලුවක් වාර්තා කර ඇත',
    open: (by, when) => `${by} ගැටලුවක් වාර්තා කළා, ${when}`, act: 'විසඳන්න හෝ ක්‍රියා කරන්න', actHint: 'කළ වැඩේ සටහන් කරන්න, නැත්නම් mould එක Workshop එකට යවන්න. දෙකෙන් එකක් කළාම මේ ගැටලුව ඉවත් වෙනවා.',
    logWork: 'කළ වැඩේ සටහන් කරන්න', sendToWorkshop: 'Workshop එකට යවන්න', reportedEntry: 'ගැටලු වාර්තාව', resolvesEntry: 'ගැටලුව විසඳයි', filter: 'වාර්තා කළ ගැටලු'
  },

  confirm: {
    cancel: 'අවලංගු කරන්න', typeToConfirm: (code) => `තහවුරු කරන්න ${code} ටයිප් කරන්න`,
    moveTitle: 'Mould එක ගෙනයන්න', move: (id, from, to) => `${id} ${from} සිට ${to} වෙත ගෙනයන්නද?`, moveBtn: 'ගෙනයන්න',
    overrideNote: (reason) => `Override — හේතුව: ${reason}`,
    statusTitle: 'තත්ත්වය වෙනස් කරන්න', status: (id, a, b) => `${id} ${a} සිට ${b} ලෙස වෙනස් කරන්නද?`, statusBtn: 'වෙනස් කරන්න',
    workTitle: 'වැඩ සටහන save කරන්න', work: (id, type, names) => `${id} මත “${type}” save කරන්නද? කළේ: ${names}`,
    workCorrection: 'මෙය කලින් සටහනක් නිවැරදි කරනවා. පරණ සටහන "නිවැරදි කළා" ලෙස ඉතිහාසයේ තියෙනවා.',
    workMove: 'Mould එක Workshop එකටත් යවනවා.', workBtn: 'Save කරන්න',
    problemTitle: 'ගැටලුවක් වාර්තා කරන්න', problem: (id) => `${id} මත ගැටලුවක් වාර්තා කරන්නද? තැන සහ තත්ත්වය වෙනස් වෙන්නේ නෑ.`, problemBtn: 'වාර්තාව යවන්න',
    deleteMouldTitle: 'Mould එක මකන්න', deleteMould: (id) => `${id} මකන්නද? පසුව නැවත ගන්න පුළුවන්; ඉතිහාසය තියෙනවා.`, reason: 'හේතුව (විකල්පයි)', deleteBtn: 'මකන්න',
    restoreMouldTitle: 'Mould එක නැවත ගන්න', restoreMould: (id) => `${id} නැවත ගන්නද? සෙවුම්වල නැවත පෙන්වයි.`, restoreBtn: 'නැවත ගන්න',
    removeItemTitle: 'Item එක ඉවත් කරන්න', removeItem: (item, id) => `${id} එකෙන් ${item} item එක ඉවත් කරන්නද?`, removeBtn: 'ඉවත් කරන්න',
    removePictureTitle: 'පින්තූරය ඉවත් කරන්න', removePicture: (item) => `${item} item එකෙන් මේ පින්තූරය ඉවත් කරන්නද?`,
    deleteUserTitle: 'User මකන්න', deleteUser: (n) => `${n} මකන්නද? එයාට ආයෙ ඇතුල් වෙන්න බෑ.`,
    roleTitle: 'භූමිකාව වෙනස් කරන්න', role: (n, a, b) => `${n} ගේ භූමිකාව ${a} සිට ${b} ලෙස වෙනස් කරන්නද?`, roleBtn: 'වෙනස් කරන්න',
    disableUserTitle: 'User අක්‍රිය කරන්න', disableUser: (n) => `${n} අක්‍රිය කරන්නද? නැවත සක්‍රිය කරන තුරු ඇතුල් වෙන්න බෑ.`, disableBtn: 'අක්‍රිය කරන්න',
    enableUserTitle: 'User සක්‍රිය කරන්න', enableUser: (n) => `${n} සක්‍රිය කරන්නද? නැවත ඇතුල් වෙන්න පුළුවන්.`, enableBtn: 'සක්‍රිය කරන්න',
    zoneDeleteTitle: 'Zone එක මකන්න', zoneDelete: (z) => `${z} zone එක සහ එහි racks සියල්ල මකන්නද? සියලු racks හිස් නම් පමණයි.`,
    rackDeleteTitle: 'Rack එක මකන්න', rackDelete: (code) => `${code} rack එක මකන්නද? හිස් නම් පමණයි.`,
    rowDeleteTitle: 'පේළිය මකන්න', rowDelete: (z, r) => `${z} zone එකේ ${r} පේළියේ racks සියල්ල මකන්නද? හිස් නම් පමණයි.`,
    zoneDisableTitle: 'Zone එක අක්‍රිය කරන්න', zoneDisable: (z) => `${z} zone එක අක්‍රිය කරන්නද? නැවත සක්‍රිය කරන තුරු එහි racks වලට moulds දාන්න බෑ.`,
    zoneEnableTitle: 'Zone එක සක්‍රිය කරන්න', zoneEnable: (z) => `${z} zone එක සක්‍රිය කරන්නද? එහි racks වලට නැවත moulds දාන්න පුළුවන්.`,
    renameZoneTitle: 'Zone එකේ නම වෙනස් කරන්න', renameZone: (z) => `${z} zone එකට අලුත් නමක් දෙන්න.`, newName: 'අලුත් නම',
    codeZoneTitle: 'Zone කේතය වෙනස් කරන්න', codeZone: (z) => `${z} zone එකේ කේතය වෙනස් කරන්නද? එහි racks (උදා: ${z}-A3) සහ moulds වල අයිතියත් එක්කම වෙනස් වෙනවා.`, newCode: 'අලුත් කේතය', saveBtn: 'Save කරන්න',
    bulkTitle: 'Racks හදන්න', bulk: (n, z) => `${z} zone එකේ racks ${n}ක් හදන්නද?`, bulkBtn: (n) => `${n}ක් හදන්න`,
    exportTitle: 'වැඩ සටහන් export කරන්න', export: (n, fmt) => `වැඩ සටහන් ${n}ක් ${fmt} ලෙස export කරන්නද? Export එක audit සටහන්වල සටහන් වෙනවා.`, exportBtn: 'Export කරන්න',
    accountTitle: 'ගිණුම් විස්තර save කරන්න', account: 'ඔබේ ගිණුමේ වෙනස්කම් save කරන්නද?', password: 'Password එක වෙනස් කරන්නද? ඊළඟ වතාවේ අලුත් එකෙන් ඇතුල් වෙන්න.', accountBtn: 'Save කරන්න',
    userPassword: (n) => `${n} ට අලුත් password එකක් දාන්නද? ඊළඟ වතාවේ එයා ඒකෙන් ඇතුල් වෙන්න ඕනේ.`
  },
  feedback: {
    working: 'වැඩ කරමින්…', moved: 'ගෙනගියා ✓', saved: 'Save කළා ✓', deleted: 'මකා දැමුවා ✓', restored: 'නැවත ගත්තා ✓', statusChanged: 'තත්ත්වය වෙනස් කළා ✓',
    shots: 'Shots සටහන් කළා ✓', reported: 'ගැටලුව වාර්තා කළා ✓', created: 'හැදුවා ✓', exported: 'Export එක සූදානම් ✓', removed: 'ඉවත් කළා ✓'
  },

  timeline: { all: 'සියල්ල', moves: 'ගෙනයාම්', work: 'වැඩ' },
  report: {
    title: 'වැඩ සටහන් වාර්තාව', mould: 'Tool ID', person: 'පුද්ගලයා', anyone: 'සියලු දෙනා', type: 'වර්ගය', anyType: 'සියලු වර්ග',
    from: 'සිට', to: 'දක්වා', machine: 'මැෂිම', exportCsv: 'CSV ලෙස ගන්න', exportXlsx: 'Excel ලෙස ගන්න', exporting: 'ගොනුව සකසමින්…',
    perPerson: 'පුද්ගලයා අනුව', person_: 'පුද්ගලයා', total: 'එකතුව', minutes: 'මිනිත්තු', repeat: 'මේ කාලයේ වැඩිපුරම වැඩ කළ moulds (නැවත නැවත එන ගැටලු)',
    entries: (n) => `සටහන් ${n}`, none: 'මේ පෙරහනට වැඩ සටහන් නෑ.', more: 'තවත් පෙන්වන්න', clear: 'පෙරහන් ඉවත් කරන්න',
    search: 'විස්තරය, කොටස්, Tool ID, Item ID, මැෂිම හෝ පුද්ගලයා සොයන්න', showing: (shown, total, range) => `${total} න් ${shown} ක් · ${range}`,
    ranges: { today: 'අද', '7d': 'පසුගිය දින 7', '30d': 'පසුගිය දින 30', month: 'මේ මාසය', all: 'සියලු කාලය', custom: 'තෝරන දින' },
    outcome: 'ප්‍රතිඵලය', anyOutcome: 'ඕනෑම ප්‍රතිඵලයක්', noOutcome: 'ප්‍රතිඵලයක් දී නෑ', status: 'පසු තත්ත්වය', anyStatus: 'ඕනෑම තත්ත්වයක්', problemOnly: 'ගැටලු වාර්තා පමණයි',
    clearAll: 'සියල්ල ඉවත් කරන්න', remove: 'පෙරහන ඉවත් කරන්න', moreFilters: 'තවත් පෙරහන්', location: 'ස්ථානය',
    exportCount: (n) => `සටහන් ${n} export කරන්න`, exportNone: 'Export කරන්න දෙයක් නෑ', exportCap: (n, cap) => `සටහන් ${n}ක් ගැලපෙනවා. Export කළ හැක්කේ ${cap} දක්වා; පෙරහන් හෝ දින අඩු කරන්න.`
  },

  users: 'Users', addUser: 'User එකතු කරන්න', editUser: 'වෙනස් කරන්න', deleteUser: 'මකන්න',
  name: 'නම', role: 'භූමිකාව', active: 'සක්‍රියයි', disabled: 'අක්‍රියයි', userSaved: 'User save කළා', userAdded: 'User එකතු කළා', userDeleted: 'User මකා දැමුවා',

  signIn: 'ඇතුල් වෙන්න', signingIn: 'ඇතුල් වෙමින්…', email: 'Email', password: 'Password', signOut: 'ඉවත් වෙන්න', loginSub: 'ඇතුල් වෙලා හැම mould එකක්ම තියෙන තැන බලන්න.',
  accountTitle: 'ගිණුම් විස්තර', mustChangePassword: 'ඉදිරියට යාමට පෙර අලුත් password එකක් තෝරන්න. පහළ වත්මන් password එක සහ අලුත් එක ඇතුළත් කරන්න.', accountSaved: 'ගිණුම් විස්තර වෙනස් කළා', keepPassword: 'Password වෙනස් නොකරන්නේ නම් අලුත් password හිස්ව තබන්න.',
  currentPassword: 'දැන් තියෙන password එක', newPassword: 'අලුත් password එක (අකුරු 8ක්වත්)', repeatPassword: 'අලුත් password එක නැවත',
  pwMismatch: 'අලුත් password දෙක ගැලපෙන්නේ නෑ', saveBtn: 'වෙනස්කම් save කරන්න', close: 'වහන්න', cancel: 'අවලංගු කරන්න', loading: 'පූරණය වෙමින්…', reload: 'නැවත පූරණය',
  install: {
    button: 'App එක install කරන්න', ios: 'Safari එකේ Share → Add to Home Screen තෝරන්න. Open as Web App පෙන්වන්නේ නම් එය on කර Add තෝරන්න.',
    other: 'Android/Windows සඳහා Chrome හෝ Edge භාවිත කරන්න. Menu එකෙන් Install app තෝරන්න. Mac Safari එකේ File → Add to Dock තෝරන්න.',
    guide: 'Device එක සකස් කරන සහ install කරන උපදෙස්'
  },

  offlineError: 'Server එකට සම්බන්ධ වෙන්න බෑ. Backend එක run වෙනවද බලන්න.',
  errors: {
    NOT_GOOD: () => 'මේ mould එක service/අලුත්වැඩියා කළ යුතුයි; යවන්න පුළුවන් Workshop එකට පමණයි.',
    MACHINE_REQUIRED: () => 'මැෂිමක් තෝරන්න.',
    MACHINE_INACTIVE: () => 'ඒ මැෂිම භාවිතයේ නෑ.',
    NO_CHANGE: () => 'වෙනස් කරන්න දෙයක් නෑ — දැනටමත් එතන තියෙනවා.',
    SERVICE_DUE: () => 'මේ mould එකේ shot සීමාව ඉක්මවලා. Service එකට Workshop එකට යවන්න.',
    MACHINE_OCCUPIED: (d) => `ඒ මැෂිමේ දැනටමත් ${d.occupant ?? 'mould එකක්'} තියෙනවා. මුලින් එය ඉවත් කරන්න.`,
    NOT_CAPABLE: (d) => `මේ mould එක ඒ මැෂිමට සඳහන් කර නෑ${Array.isArray(d.capableMachines) && d.capableMachines.length ? ` (සඳහන්: ${d.capableMachines.join(', ')})` : ''}. Override කරන්න Admin කෙනෙක්ගෙන් ඉල්ලන්න.`,
    OVERRIDE_REASON_REQUIRED: () => 'මේ මැෂිම mould එකට සඳහන් කර නෑ. Override කරන්න හේතුවක් දෙන්න.',
    RACK_REQUIRED: () => 'Rack එකක් තෝරන්න.',
    RACK_INACTIVE: () => 'ඒ rack එක භාවිතයේ නෑ.',
    RACK_FULL: () => 'ඒ rack එක පිරිලා.',
    OWNER_MISMATCH: (d) => `මේ mould එක ${d.owner} එකේ, ${d.zone} එකේ නෙවෙයි. මේ rack එක පාවිච්චි කරන්න හේතුවක් දෙන්න.`,
    REMARKS_REQUIRED: () => 'Service සහ අලුත්වැඩියාවට සටහනක් අනිවාර්යයි.',
    STATUS_ONLY_AT_WORKSHOP: () => 'තත්ත්වය වෙනස් කරන්න පුළුවන් Workshop එකේදී පමණයි.',
    NOT_AT_WORKSHOP: () => 'තත්ත්වය වෙනස් කරන්න කලින් mould එක Workshop එකට යවන්න.',
    NOT_ON_MACHINE: () => 'Shots සටහන් කරන්න පුළුවන් mould එක මැෂිමේ තියෙද්දී පමණයි.',
    INVALID_SHOTS: () => 'Shots බිංදුවට වැඩි පූර්ණ සංඛ්‍යාවක් විය යුතුයි.',
    FORBIDDEN_MOVE: () => 'මේ ගෙනයාම කරන්න ඔබට අවසර නෑ.',
    FORBIDDEN: () => 'මෙය කරන්න ඔබට අවසර නෑ.',
    MOULD_DELETED: () => 'මේ mould එක මකා දමා ඇත.',
    STALE: () => 'වෙන කෙනෙක් මේක දැන් වෙනස් කළා. Refresh කළා — ආයෙ උත්සාහ කරන්න.',
    DUPLICATE_TOOL_ID: () => 'ඒ Tool ID එක දැනටමත් තියෙනවා.',
    DUPLICATE: () => 'එය දැනටමත් තියෙනවා.',
    UNMOUNT_FIRST: () => 'මුලින් mould එක මැෂිමෙන් ඉවත් කරන්න.',
    RACK_OCCUPIED: (d) => `මුලින් ${Array.isArray(d.racks) ? d.racks.join(', ') : 'rack එකේ'} moulds ඉවත් කරන්න.`,
    NOT_FOUND: () => 'හමු වුණේ නෑ. ඉවත් කරලා ඇති.',
    INVALID_RANGE: () => 'පේළි සහ අංක පරීක්ෂා කරන්න.',
    INVALID_LOCATION: () => 'ඒ තැනට මෙතනින් දාන්න බෑ.',
    INVALID_STATUS: () => 'නොදන්නා තත්ත්වයක්.',
    GONE: () => 'මේ තිරය පරණයි. App එක නැවත පූරණය කරන්න.',
    DESCRIPTION_REQUIRED: () => 'කළේ මොකක්ද කියලා ලියන්න.',
    TOO_MANY_WORKERS: () => 'එක සටහනකට පුද්ගලයන් 5ක් දක්වා.',
    INVALID_WORKER: () => 'Mould වැඩ කරන්න අවසර තියෙන අය තෝරන්න.',
    INVALID_DATE: () => 'දිනය සහ වේලාව පරීක්ෂා කරන්න.',
    DONE_AT_FUTURE: () => 'වැඩ කළ වේලාව අනාගතයේ වෙන්න බෑ.',
    INVALID_CORRECTION: () => 'නිවැරදි කරන සටහන හමු වුණේ නෑ.',
    INVALID_PHOTO: () => 'පින්තූර JPEG, PNG හෝ WebP විය යුතුයි.',
    ISOLATION_FIRST: () => 'මුලින්ම Isolation කලාපයට යවන්න.',
    INVALID_DESTINATION: () => 'ඊළඟ තැන දිය හැක්කේ Isolation කලාපයට යවන විට පමණයි.',
    USE_CAVITY_ACTION: () => 'ඒ සඳහා "Cavities වසා run කරන්න" භාවිත කරන්න.',
    LAST_SYSTEM_ADMIN: () => 'අවම වශයෙන් සක්‍රීය System Administrator කෙනෙක් සැමවිටම සිටිය යුතුයි.',
    STALE_ACCESS: () => 'මේ අතරේ වෙන කෙනෙක් මේ access වෙනස් කළා. Reload කර නැවත උත්සාහ කරන්න.',
    PASSWORD_CHANGE_REQUIRED: () => 'මුලින්ම ඔබේ password එක වෙනස් කරන්න.',
    ROLE_LOCKED: () => 'System Administratorට සැමවිටම සියලු අවසර ඇත.',
    SUPER_ADMIN_ONLY: () => 'Out of Service access Super Adminට පමණයි.',
    INVALID_EXPIRY: () => 'කල් ඉකුත් වන දිනය අනාගතයේ විය යුතුයි.',
    TOO_MANY_IMAGES: () => 'මේ item එකට උපරිම පින්තූර ගණන දැනටමත් තියෙනවා.',
    DUPLICATE_IMAGE: () => 'මේ පින්තූරය දැනටමත් item එකේ තියෙනවා.',
    INVALID_ORDER: () => 'මේ අතරේ පින්තූර වෙනස් වුණා. Form එක ආයෙත් open කරලා උත්සාහ කරන්න.',
    TOO_LARGE: () => 'පින්තූර විශාල වැඩියි. අඩුවෙන් හෝ කුඩා පින්තූර දාන්න.',
    EXPORT_TOO_LARGE: (d) => `සටහන් ${d.total}ක් ගැලපෙනවා. Export කළ හැක්කේ ${d.cap} දක්වා; පෙරහන් හෝ දින අඩු කරන්න.`
  }
};

export const I18N: Record<Lang, Dict> = { en, si };

// Location name; the Mould Room name always comes from its single key.
export const locationName = (loc: Location, translations: Dict) => (loc === 'MOULD_ROOM' ? translations.mouldRoom : translations.loc[loc]);
