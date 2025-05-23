
import { anyDict } from 'types/index';
import { Application } from '../../types/automation';
import { app, BrowserWindow, Size } from 'electron';
import { createWindow, getCurrentScreen, getCenteredCoordinates, ensureOnCurrentScreen, releaseFocus } from './index';

export let promptAnywhereWindow: BrowserWindow = null;

const kWidthMinimum = 800;
const kWidthMaximum = 1000;
const kWidthRatio = 2.25;

const desiredSize = (): Size => ({
  width: Math.min(kWidthMaximum, Math.max(kWidthMinimum, Math.floor(getCurrentScreen().workAreaSize.width / kWidthRatio))),
  height: Math.floor(getCurrentScreen().workAreaSize.height * 0.80)
});

export const preparePromptAnywhere = (queryParams?: anyDict): void => {

  // get bounds
  const size = desiredSize();
  const { x } = getCenteredCoordinates(size.width, size.height);
  const y = Math.floor(size.height * 0.18);

  // open a new one
  promptAnywhereWindow = createWindow({
    hash: '/prompt',
    queryParams: queryParams,
    x, y, width: size.width, height: size.height,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    //opacity: 0.975,
    resizable: process.env.DEBUG ? true : false,
    // backgroundColor: 'rgba(255, 255, 255, 0)',
    // vibrancy: 'hud',
    transparent: true,
    hiddenInMissionControl: true,
    keepHidden: true,
    hasShadow: false,
    movable: true,
  });

  // // open the DevTools
  // if (process.env.DEBUG) {
  //   promptAnywhereWindow.webContents.openDevTools({ mode: 'right' });
  // }

  // get focus
  // opacity trick is to avoid flickering on Windows
  promptAnywhereWindow.on('show', () => {
    app.focus({ steal: true });
    promptAnywhereWindow.moveTop();
    promptAnywhereWindow.focusOnWebView();
    if (promptAnywhereWindow.getOpacity() !== 1) {
      setTimeout(() => {
        promptAnywhereWindow.setOpacity(1);
      }, 100);
    }
  });

  // opacity trick is to avoid flickering on Windows
  promptAnywhereWindow.on('hide', () => {
    if (process.platform === 'win32') {
      promptAnywhereWindow.setOpacity(0);
    } else {
      promptAnywhereWindow.setOpacity(1);
    }
  });

  // prevent close with keyboard shortcut
  promptAnywhereWindow.on('close', (event) => {
    closePromptAnywhere();
    event.preventDefault();
  });

}

export const openPromptAnywhere = (params: anyDict): void => {

  // if we don't have a window, create one
  if (!promptAnywhereWindow || promptAnywhereWindow.isDestroyed()) {
    preparePromptAnywhere(params);
  } else {
    promptAnywhereWindow.webContents.send('show', params);
  }

  // adjust height to current screem
  const windowSize = promptAnywhereWindow.getSize();
  promptAnywhereWindow.setSize(windowSize[0], desiredSize().height);

  // check prompt is on the right screen
  ensureOnCurrentScreen(promptAnywhereWindow);

  // done
  promptAnywhereWindow.show();

};

export const closePromptAnywhere = async (sourceApp?: Application): Promise<void> => {

  // check
  if (promptAnywhereWindow === null || promptAnywhereWindow.isDestroyed() || promptAnywhereWindow.isVisible() === false) {
    return;
  }

  try {

    // hide from user as early as possible
    promptAnywhereWindow.setOpacity(0);

    // now release focus
    await releaseFocus({ sourceApp });

    // now hide (opacity will be restored on 'hide')
    promptAnywhereWindow.hide();

  } catch (error) {
    console.error('Error while hiding prompt anywhere', error);
    promptAnywhereWindow = null;
  }

}

export const resizePromptAnywhere = (deltaX: number, deltaY: number): void => {
  const bounds = promptAnywhereWindow.getBounds();
  bounds.width += deltaX;
  bounds.height += deltaY;
  promptAnywhereWindow.setBounds(bounds);
}
