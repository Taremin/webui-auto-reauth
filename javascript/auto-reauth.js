const storage = sessionStorage
const storageKey = "webui-auto-reauth"
const state = {
    count: 0,
    enable: true,
    user: "",
    password: "",
    intervalId: null,
}
Object.assign(state, storage.getItem(storageKey) || {})

const defaultFetch = fetch
window.fetch = (input, init, ...args) => {
    if (init && init.body && init.headers && init.headers["Content-Type"] === "application/json") {
        const body = ((body) => {
            try {
                return JSON.parse(body)
            } catch(e) {
                return {}
            }
        })(init.body)

        if (body.session_hash && body.fn_index) {
            state.sessionHash = body.session_hash
            state.fnIndex = body.fn_index
        }
    }
    return defaultFetch(input, init, ...args)
}

const defaultWebSocket = WebSocket
const websocketDescriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onclose')
class HookedWebSocket extends defaultWebSocket {
    constructor(...args) {
        let retVal = super(...args)

        if (state.wsNotAvailable) {
            this.wasClean = false
        }

        this.addEventListener('message', (ev) => {
            const data = ((data) => {
                try {
                    return JSON.parse(data)
                } catch(e) {
                    return {}
                }
            })(ev.data)
            if (data && data.msg && data.msg && data.output) {
                if (data.output.error || !data.success) {
                    console.error('WebSocket Error:', data)
                    state.wsNotCleanOnce = true
                    this.close()
                }
            }
        })

        this.addEventListener('close', (ev) => {
            if (!ev.wasClean) {
                state.wsNotAvailable = true
            }
        })
        return retVal
    }

    set onclose(func) {
        websocketDescriptor.set.call(this, (ev, ...args) => {
            if (state.wsNotAvailable || state.wsNotCleanOnce) {
                Object.defineProperty(ev, 'wasClean', {
                    value: false
                })
            }
            state.wsNotCleanOnce = false
            func(ev, ...args)
        })
    }
}
window.WebSocket = HookedWebSocket

{(async () => {
    const authInfo = await fetch("/auto_reauth_info").then(res => res.json())
    if (authInfo.username && authInfo.password) {
        state.user = authInfo.username
        state.password = authInfo.password
    }
})()}

const update = (button) => {
    if (state.intervalId !== null) {
        clearInterval(state.intervalId)
    }
    if (state.enable) {
        button.textContent = `Auto-Reauth(Enable): ${state.count}`
        state.intervalId = setInterval(
            async () => {
                const status = await fetch("/login_check", {cache: "no-store"}).then(res => res.status)
                if (status === 401) {
                    const formData = new FormData();
                    formData.append('username', state.user)
                    formData.append('password', state.password)

                    const result = await fetch("/login", {
                        method: "POST",
                        body: formData
                    }).then(res => res.json())

                    state.wsNotAvailable = false
                    state.count++
                    this.update(button)

                    if (!state.sessionHash || !state.fnIndex) {
                        console.error("session information not valid")
                        return
                    }

                    const reset = await fetch("/reset", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            session_hash: state.sessionHash,
                            fn_index: state.fnIndex
                        })
                    })
                }
            },
            5 * 1000
        )
    } else {
        button.textContent = "Auto-Reauth(Disable)"
        state.intervalId =  null
    }
}

const createView = () => {
    const container = document.createElement('div')
    const button = document.createElement('button')
    button.addEventListener('click', (ev) => {
        state.enable = !state.enable
        update(ev.target)
    })
    container.appendChild(button)

    Object.assign(
        container.style,
        {
            position: "fixed",
            left: 0,
            top: 0,
            backgroundColor: "white",
            zIndex: 10000,
            border: "1px solid black",
            userSelect: "none",
        }
    )

    document.body.appendChild(container)
    update(button)
}

onUiLoaded(createView)