class predocsHelper {

    _PWA() {
        const link = document.createElement("link");
        this.adicionarAtributos(link, {
            rel: "manifest",
            href: this.getUrl("/config/manifest.json"),
        });
        document.querySelector("head").prepend(link);

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register(this.getUrl("/sw.js"))
                .catch((err) => {
                    console.error("Erro ao registrar o Service Worker: ", err);
                });
            window.addEventListener("beforeinstallprompt", (e) => {
                this.deferredPrompt = e;
            });
        }
    }

    _criarMetaDados() {
        const metadados = [
            { tipo: "meta", name: "viewport", content: "width=device-width, initial-scale=1.0" },
            { tipo: "meta", httpEquiv: "X-UA-Compatible", content: "IE=edge" },
            { tipo: "meta", charset: "utf-8" },
            {
                tipo: "link",
                rel: "shortcut icon",
                href: this.getUrl("/assets/global/favicon.ico"),
                type: "image/x-icon",
            },
            {
                tipo: "link",
                rel: "apple-touch-icon",
                href: this.getConfig("iconApp"),
            },
            {
                tipo: "meta",
                name: "theme-color",
                content: this.getConfig("corApp"),
            },
        ];

        metadados.forEach((md) => {
            const elemento = document.createElement(md.tipo);
            this.adicionarAtributos(elemento, md);
            document.querySelector("head").prepend(elemento);
        });

        document.querySelector("html").setAttribute("lang", "pt-br");
    }

    _incluirComponentsGlobais() {
        const includes = JSON.parse(this.get("/config/includes.json"));

        Promise.all(
            includes.componentsGlobal.map((c) => {
                if (!this.recurso.componentesBloqueados.includes(c.component)) {
                    this.criarComponente(
                        c.component,
                        c.element,
                        c.local,
                        c.css,
                        c.js
                    );
                }
            })
        );
    }

    _incluirDependenciasCss() {
        const cssFiles = JSON.parse(this.get("/config/includes.json")).cssFiles;

        // Função para adicionar as tags <link> ao <head>
        let head = document.head;

        cssFiles.forEach(function (cssFile) {
            var link = document.createElement("link");
            link.rel = "stylesheet";
            link.type = "text/css";
            link.href = cssFile;
            head.appendChild(link);
        });
    }

    _incluirDependenciasJS() {
        const jsFiles = JSON.parse(this.get("/config/includes.json")).jsFiles;

        // Função para adicionar as tags <script> ao <body>
        let body = document.body;

        jsFiles.forEach(function (jsFile) {
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.src = jsFile;
            body.appendChild(script);
        });
    }

    _onloadBody(after) {
        document.querySelector("body").onload = () => {
            if (typeof after === "function") {
                after();
            }
        };
    }

    _desabilitarAutocomplete() {
        Array.from(
            document.querySelectorAll("input:not([autocomplete])")
        ).forEach((element) => {
            this.adicionarAtributos(element, {
                autocomplete: "off",
            });
        });
    }
}

class Predocs extends predocsHelper {
    config = {};

    recurso = {
        componentesBloqueados: [],
    };

    deferredPrompt;

    constructor(params = {}) {
        super();

        this.recurso.componentesBloqueados = params.componentesBloqueados || [];
    }

    init(before, after) {
        this._incluirDependenciasCss();
        this._incluirDependenciasJS();
        this._incluirComponentsGlobais();
        this._criarMetaDados();
        this._PWA();

        if (typeof before === "function") {
            before();
        }

        this._onloadBody(after);
        this._desabilitarAutocomplete();
    }

    getModoExecucao() {
        const suportaModoStandalone = window.matchMedia(
            "(display-mode: standalone)"
        ).matches;
        if (document.referrer.startsWith("android-app://")) {
            return "PWA";
        } else if (navigator.standalone || suportaModoStandalone) {
            return "Standalone";
        }
        return "Navegador";
    }

    get(url, params = {}) {
        return this.request(url, {}, params, "GET")
    }

    post(url, dadosPost, paramsUrl = {}, aguardaResposta = true) {
        return this.request(url, dadosPost, paramsUrl, "POST", aguardaResposta);
    }

    request(url, dados, param, method, aguardaResposta = true) {
        const fullUrl = this.addParamsToUrl(this.getUrl(url), param);
        try {
            const xhttp = new XMLHttpRequest();
            xhttp.open(method, fullUrl, !aguardaResposta); // false = aguarda retorno
            xhttp.send(JSON.stringify(dados));
            return xhttp.responseText;
        } catch (e) {
            console.error(e);
        }

        return undefined;
    }

    createFormDataObject(formData) {
        const formDataObject = {};
        formData.forEach((value, key) => {
            formDataObject[key] = value;
        });
        return formDataObject;
    }

    async submitForm(formElement, onSuccess, onError) {
        try {
            const formData = new FormData(formElement);
            const formDataObject = this.createFormDataObject(formData);

            const response = await this.request(
                "/server" + formElement.action.replace(location.origin, ""),
                formDataObject,
                {},
                formElement.getAttribute('metodo')
            );

            const jsonResponse = JSON.parse(response);
            const resposta = onSuccess(jsonResponse);
            return resposta;
        } catch (error) {
            onError(error);
            throw error;
        }
    }

    form(formSelector, beforeSubmit, afterSubmit, createLoading = true) {
        if (createLoading) {
            this.criarComponente("loading-form", formSelector, "lado", ["/components/css/loading-form.css"], ["/components/js/loading-form.js"]);
        }
        
        document.querySelector(formSelector).addEventListener("submit", async (event) => {
            event.preventDefault();
            const formElement = document.querySelector(formSelector);
            
            if (createLoading) {
                var loadingForm = new LoadingForm(formSelector);
            }
            
            if (beforeSubmit() !== false) {
                await loadingForm.showLoading();
                await this.delay(500);
                try {
                    const resposta = await this.submitForm(
                        formElement,
                        afterSubmit,
                        (error) => {
                            if (createLoading) {
                                loadingForm.showError();
                            }
                            console.error(error);
                        }
                    );

                    if (createLoading) {
                        loadingForm.showSuccess(resposta);
                    }
                } catch (error) {
                    console.error(error);
                }
            }
        });

        return true;
    }

    montaSelect = (element, options) => {
        options.forEach(({ value, text, selected, disabled }) => {
            const option = document.createElement("option");
            option.value = value || text;
            option.textContent = text;
            option.disabled = disabled ?? false;
            option.selected = selected ?? false;
            document.querySelector(element).appendChild(option);
        });
        return true;
    };

    replaceTextInView(elemSelector, replacements) {
        let html = document.querySelector(elemSelector).innerHTML;
        Object.keys(replacements).forEach((key) => {
            html = html.replace(
                new RegExp(`{{${key}}}`, "g"),
                replacements[key]
            );
        });
        document.querySelector(elemSelector).innerHTML = html;
        return true;
    }

    criarComponente(component, element, local, css = [], js = []) {
        let componentElement;

        componentElement = document.createElement("section");
        componentElement.setAttribute(
            "class",
            `component-${component}`
        );

        switch (local) {
            case "append":
            case "final":
                document.querySelector(element).append(componentElement);
                break;
            case "lado":
                document.querySelector(element).parentElement.append(componentElement);
                break;
            case "incio":
            case "prepend":
            default:
                document.querySelector(element).prepend(componentElement);
        }

        componentElement.innerHTML = this.get(
            `/components/html/${component}.html`
        );
        this.incluirRecurso("script", js);
        this.incluirRecurso("link", css);

        return true;
    }

    getUrl(url) {
        if (url.startsWith("/server")) {
            return this.getConfig("servidor") + url.replace("/server/", "");
        } else {
            return url.startsWith("/")
                ? `${document
                    .querySelector("#coreJs")
                    .src.replace("/core/predocs.js", "")}${url}`
                : url;
        }
    }

    getConfig(tipo) {
        if (!this.config[tipo]) {
            switch (tipo) {
                case "app":
                    this.config[tipo] = JSON.parse(
                        this.get("/config/app.json")
                    );
                    break;
                case "servidor":
                    this.config[tipo] = JSON.parse(
                        this.get("/config/app.json")
                    ).server;
                    break;
                case "iconApp":
                    this.config[tipo] = JSON.parse(
                        this.get("/config/manifest.json")
                    ).icons[0].src;
                    break;
                case "corApp":
                    this.config[tipo] = JSON.parse(
                        this.get("/config/manifest.json")
                    ).theme_color;
                    break;
                default:
                    break;
            }
        }
        return this.config[tipo];
    }

    adicionarAtributos(elemento, atributos) {
        Object.entries(atributos).forEach(([chave, valor]) => {
            if (chave !== "tipo") {
                elemento.setAttribute(chave, valor);
            }
        });
    }

    async incluirRecurso(tipo = "script", links = []) {
        for (const link of links) {
            await new Promise((resolve, reject) => {
                const recurso = document.createElement(tipo);
                if (tipo === "script") {
                    recurso.setAttribute("src", this.getUrl(link));
                    recurso.onload = resolve;
                    recurso.onerror = reject;
                } else if (tipo === "link") {
                    recurso.setAttribute("rel", "stylesheet");
                    recurso.setAttribute("href", this.getUrl(link));
                    resolve();
                }
                document.querySelector(tipo === "script" ? "body" : "head").appendChild(recurso);
            });
        }
    }


    addParamsToUrl(url, params) {
        let queryParams = Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join("&");

        return `${url}?${queryParams}`;
    }

    async installApp(aceitou = () => { }, recusou = () => { }) {
        try {
            await this.deferredPrompt.prompt();
            const choice = await this.deferredPrompt.userChoice;

            if (choice.outcome === "accepted") {
                aceitou();
            } else {
                recusou();
            }
        } catch (error) {
            console.error(error);
        } finally {
            this.deferredPrompt = null;
        }
    }

    getParamUrl($param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get($param);
    }

    delay(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }
}
