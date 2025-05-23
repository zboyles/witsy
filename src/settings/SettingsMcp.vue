<template>
  <div>
    <div class="description">
      {{ t('settings.plugins.mcp.description') }}
      <a href="https://docs.anthropic.com/en/docs/build-with-claude/mcp" target="_blank">{{ t('settings.plugins.mcp.modelContextProtocol') }}</a> (MCP)
      {{ t('settings.plugins.mcp.servers') }}
      <a href="https://smithery.ai" target="_blank">{{ t('settings.plugins.mcp.smithery') }}</a>.
    </div>
    <!--div class="description status" v-if="status">
      <span v-if="status.servers == 0">{{ t('settings.plugins.mcp.noServersFound') }}</span>
      <span v-else><b>
        <span>{{ t('settings.plugins.mcp.connectedToServers', { count: status.servers }) }}</span>
        <span v-if="status.tools > 0"><br/>{{ t('settings.plugins.mcp.totalTools', { count: status.tools }) }}</span>
        <span v-else><br/>{{ t('settings.plugins.mcp.noTools') }}</span>
      </b></span>
    </div-->
    <div class="group">
      <label>{{ t('common.enabled') }}</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
    <div class="servers list-with-actions">
      <div class="header">
        <span>{{ t('settings.plugins.mcp.mcpServers') }}</span>
        <Spinner v-if="loading" />
      </div>
      <div class="sticky-table-container" v-if="servers.length">
        <table class="list">
          <thead>
            <tr>
              <th>&nbsp;</th>
              <th>{{ t('common.type') }}</th>
              <th>{{ t('settings.plugins.mcp.target') }}</th>
              <th>{{ t('settings.plugins.mcp.tools') }}</th>
              <th>{{ t('settings.plugins.mcp.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="server in servers" :key="server.uuid" :class="{ selected: selected == server }" @click="selected = server" @dblclick="edit(server)">
              <td class="enabled"><input type="checkbox" :checked="server.state == 'enabled'" @change="onEnabled(server)" /></td>
              <td>{{ getType(server) }}</td>
              <td>{{ getDescription(server) }}</td>
              <td class="tools center">
                <BIconSearch @click="showTools(server)" v-if="isRunning(server)"/>
              </td>
              <td class="status center">
                <a @click.prevent="showLogs(server)" v-if="hasLogs(server)">{{ getStatus(server) }}</a>
                <span v-else>{{ getStatus(server) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="actions">
        <button ref="addButton" class="button add" @click.prevent="onAdd"><BIconPlus /></button>
        <button class="button remove" @click.prevent="onDelete" :disabled="!selected"><BIconDash /></button>
      </div>
      <div style="margin-top: 16px">
        <button name="reload" @click.prevent="reload">{{ t('common.refresh') }}</button>
        <button name="restart" @click.prevent="onRestart">{{ t('settings.plugins.mcp.restartClient') }}</button>
      </div>
    </div>
    <ContextMenu v-if="showAddMenu" :on-close="closeAddMenu" :actions="addMenuActions" @action-clicked="handleAddAction" :x="addMenuX" :y="addMenuY" position="above" :teleport="false" />
    <McpServerEditor ref="editor" :server="selected" @save="onEdited" @install="onInstall" />
  </div>
</template>

<script setup lang="ts">

import { ref, nextTick } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { McpServer, McpServerStatus } from '../types/mcp'
import ContextMenu from '../components/ContextMenu.vue'
import McpServerEditor from '../screens/McpServerEditor.vue'
import Dialog from '../composables/dialog'
import Spinner from '../components/Spinner.vue'
import Swal from 'sweetalert2/dist/sweetalert2.js'

const editor = ref(null)
const addButton = ref(null)
const enabled = ref(false)
const servers = ref([])
const status = ref(null)
const selected = ref(null)
const showAddMenu = ref(false)
const addMenuX = ref(0)
const addMenuY = ref(0)
const loading = ref(false)

const getType = (server: McpServer) => {
  if (server.url.includes('@smithery/cli')) return 'smithery'
  else return server.type
}

const getDescription = (server: McpServer) => {
  if (server.type == 'sse') return server.url
  if (server.url.includes('@smithery/cli')) {
    const index = server.command === 'cmd' && server.url.startsWith('/c') ? 2 : 0 
    return server.url.replace('-y @smithery/cli@latest run ', '').split(' ')[index]
  }
  if (server.type == 'stdio') return server.command.split(/[\\/]/).pop() + ' ' + server.url
}

const isRunning = (server: McpServer) => {
  if (server.state == 'disabled') return false
  const s = status.value?.servers.find((s: McpServerStatus) => s.uuid == server.uuid)
  return s ? true : false
}

const getStatus = (server: McpServer) => {
  if (server.state == 'disabled') return '🔶'
  return isRunning(server) ? '✅' : '❌'
}

const hasLogs = (server: McpServer) => {
  return status.value?.logs?.[server.uuid]
}

const load = async () => {
  enabled.value = store.config.plugins.mcp.enabled || false
  servers.value = await window.api.mcp.getServers()
  status.value = await window.api.mcp.getStatus()
  loading.value = false
}

const save = async () => {
  store.config.plugins.mcp.enabled = enabled.value
  store.saveSettings()
}

const reload = async () => {
  loading.value = true
  nextTick(async () => {
    await load()
  })
}

const showLogs = (server: McpServer) => {
  Dialog.show({
    title: t('settings.plugins.mcp.serverLogs'),
    text: status.value.logs[server.uuid].join(''),
    confirmButtonText: t('common.close'),
  })
}

const showTools = async (server: McpServer) => {
  const tools = await window.api.mcp.getServerTools(server.registryId)
  if (tools.length) {
    Dialog.show({
      title: t('settings.plugins.mcp.tools'),
      html: tools.map((tool: any) => `<li><b>${tool.name}</b><br/>${tool.description}</li>`).join(''),
      customClass: { confirmButton: 'alert-confirm', htmlContainer: 'list' },
      confirmButtonText: t('common.close'),
    })
  } else {
    Dialog.show({
      title: t('settings.plugins.mcp.noTools'),
      confirmButtonText: t('common.close'),
    })
  }
}

const onRestart = async () => {
  loading.value = true
  status.value = { servers: [], logs: {} }
  nextTick(async () => {
    await window.api.mcp.reload()
    load()
  })
}

// Add the context menu actions
const addMenuActions = [
  { label: t('settings.plugins.mcp.addCustomServer'), action: 'custom' },
  { label: t('settings.plugins.mcp.importSmitheryServer'), action: 'smithery' },
  { label: t('settings.plugins.mcp.importJson.menu'), action: 'json' },
]

// Add these methods to handle the plus button menu
const onAdd = (event: MouseEvent) => {
  const rcButton = addButton.value.getBoundingClientRect()
  const rcDialog = addButton.value.closest('.window').getBoundingClientRect()
  addMenuX.value = rcButton.left - rcDialog.left
  addMenuY.value = rcDialog.bottom - rcButton.bottom + rcButton.height + 8
  showAddMenu.value = true
}

const closeAddMenu = () => {
  showAddMenu.value = false
}

const handleAddAction = (action: string) => {
  closeAddMenu()
  if (action === 'custom') {
    onCreate('stdio')
  } else if (action === 'smithery') {
    onCreate('smithery')
  } else if (action === 'json') {
    onImportJson()
  }
}

const onCreate = (type: string) => {
  selected.value = {
    uuid: null,
    registryId: null,
    state: 'enabled', 
    type: type,
    command: '',
    url: '' 
  }
  editor.value.show()
}

const onImportJson = async () => {

  const result = await Dialog.show({
    title: t('settings.plugins.mcp.importJson.title'),
    text: t('settings.plugins.mcp.importJson.details'),
    input: 'textarea',
    inputAttributes: { rows: 10 },
    inputPlaceholder: '"mcp-server-name": {\n  "command": "",\n  "args": [ … ]\n}',
    customClass: { input: 'auto-height' },
    inputValue: '',
    showCancelButton: true,
    preConfirm: (json: any) => {
      try {
        return validateServerJson(json)
      } catch (error) {
        Swal.showValidationMessage(error.message);
      }
    }
  })

  if (result.isConfirmed) {

    // build a dummy server
    const server: McpServer = {
      uuid: null,
      registryId: null,
      state: 'enabled',
      type: 'stdio',
      command: result.value.command,
      url: result.value.args.join(' '),
      cwd: result.value.cwd,
      env: result.value.env || {}
    }

    // edit it
    loading.value = true
    nextTick(async () => {
      await window.api.mcp.editServer(server)
      load()
    })

  }

}

const onDelete = async () => {
  if (!selected.value) return
  Dialog.show({
    target: document.querySelector('.settings .plugins'),
    title: t('settings.plugins.mcp.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then(async (result) => {
    if (result.isConfirmed) {
      loading.value = true
      nextTick(async () => {
        await window.api.mcp.deleteServer(selected.value.registryId)
        selected.value = null
        load()
      })
    }
  })
}

const onEnabled = async (server: McpServer) => {
  loading.value = true
  nextTick(async () => {
    server.state = (server.state == 'enabled' ? 'disabled' : 'enabled')
    await window.api.mcp.editServer(JSON.parse(JSON.stringify(server)))
    load()
  })
}

const edit = (server: McpServer) => {
  selected.value = server
  editor.value.show()
}

// @ts-expect-error lazy
const onEdited = async ({ type, command, url, cwd, env }) => {

  // build a dummy server
  const server: McpServer = {
    uuid: selected.value.uuid,
    registryId: selected.value.registryId,
    state: selected.value.state,
    type, command, url, cwd, env
  }

  // edit it
  loading.value = true
  nextTick(async () => {
    await window.api.mcp.editServer(server)
    load()
  })

}

// @ts-expect-error lazy
const onInstall = async ({ registry, server }) => {

  loading.value = true
  nextTick(async () => {

    const rc = await window.api.mcp.installServer(registry, server)
    if (!rc) {
      loading.value = false
      Dialog.show({
        title: t('settings.plugins.mcp.failedToInstall'),
        text: t('settings.plugins.mcp.copyInstallCommand'),
        confirmButtonText: t('common.copy'),
        showCancelButton: true,
      }).then((result) => {
        if (result.isConfirmed) {
          const command = window.api.mcp.getInstallCommand(registry, server)
          navigator.clipboard.writeText(command)
        }
      })
    }

    load()

  })

}

const validateServerJson = (json: string) => {

  // build a proper payload
  json = json.trim()
  if (json.endsWith(',')) {
    json = json.slice(0, -1).trim()
  }
  if (!json.length) {
    throw new Error(t('settings.plugins.mcp.importJson.errorEmpty'))
  }
  if (!json.startsWith('{')) {
    json = `{${json}}`
  }

  // parse it (might throw a syntax error)
  let dict
  try {
    dict = JSON.parse(json)
  } catch {
    throw new Error(t('settings.plugins.mcp.importJson.errorFormat'))
  }
  
  // need an object with exactly one key
  if (typeof dict !== 'object') throw new Error(t('settings.plugins.mcp.importJson.errorFormat'))
  if (Object.keys(dict).length != 1) throw new Error(t('settings.plugins.mcp.importJson.errorMultiple'))

  // get the server and check command and args
  const server = dict[Object.keys(dict)[0]]
  if (typeof server.command !== 'string' || !server.command?.length) throw new Error(t('settings.plugins.mcp.importJson.errorCommand'))
  if (!Array.isArray(server.args)) throw new Error(t('settings.plugins.mcp.importJson.errorArgs'))
  
  // done
  return server

}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
@import '../../css/panel.css';
@import '../../css/list-with-actions.css';
@import '../../css/sticky-header-table.css';
</style>

<style>
.status {
  font-weight: bold;
}

.servers {
  
  margin-top: 16px;
  padding-left: 32px;
  padding-right: 16px;

  .header {
    display: flex;
    justify-content: space-between;
    font-size: 10pt;
    margin-bottom: 8px;
    padding-right: 4px;
  }

  .sticky-table-container {
    height: 120px !important;
  }

  .list {
    width: 100% !important;

    td {
      padding-top: 3px !important;
      padding-bottom: 3px !important;

      max-width: 200px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;

      a {
        cursor: pointer;
      }

      &.tools {
        cursor: pointer;
      }
    }
  }
}

</style>
