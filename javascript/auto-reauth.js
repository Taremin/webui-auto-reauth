const storage = sessionStorage
const storageKey = "webui-auto-reauth"
const state = storage.getItem(storageKey) ?
    JSON.parse(storage.getItem(storageKey)) :
    {
        enable: false,
        user: "",
        password: "",
        intervalId: null,
    }

const update = () => {
    if (state.intervalId !== null) {
        clearInterval(state.intervalId)
    }
    state.intervalId = state.enable ?
        setInterval(async () => {
            const status = await fetch("/file=style.css?reauth-ping", {cache: "no-store"}).then(res => res.status)
            if (status === 401) {
                const formData = new FormData();
                formData.append('username', state.user)
                formData.append('password', state.password)

                const result = await fetch("/login", {
                    method: "POST",
                    body: formData
                }).then(res => res.json())
            }
        }, 30 * 1000) : null
}

const createView = () => {
    const container = document.createElement('div')
    const header = document.createElement('header')
    const body = document.createElement('section')

    container.appendChild(header)
    container.appendChild(body)

    header.textContent = "webui-auto-reauth"
    header.addEventListener('click', (ev) => {
        if (body.style.display === "none") {
            body.style.display = "block"
        } else {
            body.style.display = 'none'
        }
    })

    const newLine = (container) => {
        container.appendChild(document.createElement('br'))
    }

    const enable = document.createElement('input')
    enable.type = "checkbox"
    enable.checked = state.enable
    const enableLabel = document.createElement('label')
    enableLabel.textContent = "Enable"
    enableLabel.prepend(enable)
    body.appendChild(enableLabel)

    newLine(body)

    const user = document.createElement('input')
    user.type = "text"
    user.placeholder = "username"
    user.value = state.user
    body.appendChild(user)

    newLine(body)

    const password = document.createElement('input')
    password.type = "password"
    password.placeholder = "password"
    password.value = state.password
    body.appendChild(password)

    newLine(body)

    const button = document.createElement('button')
    button.textContent = "Update State"
    button.addEventListener('click', (ev) => {
        state.enable = enable.checked
        state.user = user.value
        state.password = password.value
        storage.setItem(storageKey, JSON.stringify(state))
        update()
    })
    body.appendChild(button)

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
    update()
}

onUiLoaded(createView)