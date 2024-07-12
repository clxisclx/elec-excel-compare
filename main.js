const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

let mainWindow;
let previewData;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1800,
    height: 1600,
    minWidth: 800,
    minHeight: 600,
    maxWidth: 1800,
    maxHeight: 1600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  mainWindow.webContents.session.clearStorageData(['localStorage']);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

try {
  require('electron-reloader')(module, {});
} catch (_) {}

ipcMain.handle('read-excel', async (event, filePath) => {
  console.log('read');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  //   return xlsx.utils.sheet_to_json(sheet);
  return {
    data: xlsx.utils.sheet_to_json(sheet),
    filePath,
  };
});

let targetList = [];
ipcMain.on('export-excel', async (event, source, compare) => {
  // 去除首尾特殊字符
  source.forEach((item) => (item['商城订单交易编号1'] = item['商城订单交易编号1'].trim()));
  compare.forEach((item) => (item['商城订单号'] = item['商城订单号'].trim()));

  // 生成比较map
  const compareMap = compare.reduce((acc, item) => {
    acc[item['商城订单号']] = item;
    return acc;
  }, {});

  for (const item of source) {
    if (!item['商城订单平台']) continue;
    let target = {
      商城订单平台: item['商城订单平台'],
      订单号: item['商城订单交易编号1'],
      '分佣金额(厘)': item['交易金额(厘）'],
    };

    const matchedItem = compareMap[item['商城订单交易编号1']];
    if (matchedItem) {
      target['商城订单号'] = matchedItem['商城订单号'];
      target['商城分佣(元)'] = matchedItem['商城分佣'];
      target['合伙人实际分佣(厘)'] = Math.floor(matchedItem['商城分佣'] * 1000 * 0.95);
      target['是否匹配'] = target['合伙人实际分佣(厘)'] - target['分佣金额(厘)'] <= 10 ? '是' : '否';
      target['理由'] = target['是否匹配'] === '是' ? '' : '金额不匹配';
    } else {
      target['是否匹配'] = '否';
      target['理由'] = '未找到订单';
    }
    targetList.push(target);
  }

  const day = new Date();
  const title = `比较结果_${day.getFullYear()}-${
    day.getMonth() + 1
  }-${day.getDate()} ${day.getHours()}:${day.getMinutes()}:${day.getSeconds()}.xlsx`;

  const savePath = dialog.showSaveDialogSync({
    title: title,
    defaultPath: title,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  });
  if (savePath) {
    const newWorkbook = xlsx.utils.book_new();
    const newWorksheet = xlsx.utils.json_to_sheet(targetList);
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Sheet1');
    xlsx.writeFile(newWorkbook, savePath);
  }
});
