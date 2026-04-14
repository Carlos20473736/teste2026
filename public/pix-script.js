class PixAssistindoManager {
    constructor() {
        // Inicializar sistema de segurança de sessão única
        this.sessionSecurity = new SessionSecurity();
        
        // Validar acesso antes de inicializar
        this.validateAccess();
        
        this.isRunning = false;
        this.intervalId = null;
        this.stats = {
            requests: 0,
            successes: 0,
            errors: 0,
            totalEarnings: 0
        };
        this.autoScroll = true;
        this.currentUserData = null;
        this.rewardsConfig = null;
        this.sessionStartTime = Date.now();
        this.timerIntervalId = null;
        
        // Inicializar segurança de sessão
        this.initializeSessionSecurity();
        
        this.initializeElements();
        this.startSessionTimer();
        this.bindEvents();
        this.loadSettings();
        this.updateUI();
        this.loadRewardsConfig();
    }

    initializeElements() {
        // Form elements
        this.emailInput = document.getElementById('email');
        this.tipoAnuncioSelect = document.getElementById('tipoAnuncio');
        this.intervalSlider = document.getElementById('interval');
        this.intervalValue = document.getElementById('intervalValue');
        
        // Control buttons
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.autoScrollBtn = document.getElementById('autoScrollBtn');
        
        // Status elements
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        
        // Stats elements
        this.requestCount = document.getElementById('requestCount');
        this.successCount = document.getElementById('successCount');
        this.errorCount = document.getElementById('errorCount');
        this.totalEarnings = document.getElementById('totalEarnings');
        
        // Containers
        this.userInfoContainer = document.getElementById('userInfoContainer');
        this.missionContainer = document.getElementById('missionContainer');
        this.rewardsContainer = document.getElementById('rewardsContainer');
        this.logContainer = document.getElementById('logContainer');
    }

    bindEvents() {
        // Slider value update
        this.intervalSlider.addEventListener('input', (e) => {
            this.intervalValue.textContent = e.target.value;
            this.saveSettings();
        });

        // Control buttons
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.clearBtn.addEventListener('click', () => this.clearLog());
        this.autoScrollBtn.addEventListener('click', () => this.toggleAutoScroll());

        // Save settings on input change
        this.emailInput.addEventListener('input', () => this.saveSettings());
        this.tipoAnuncioSelect.addEventListener('change', () => this.saveSettings());

        // Prevent form submission on Enter
        this.emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!this.isRunning && this.validateInputs()) {
                    this.start();
                }
            }
        });
    }

    saveSettings() {
        const settings = {
            email: this.emailInput.value,
            tipoAnuncio: this.tipoAnuncioSelect.value,
            interval: this.intervalSlider.value
        };
        localStorage.setItem('pixAssistindoSettings', JSON.stringify(settings));
    }

    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('pixAssistindoSettings') || '{}');
            if (settings.email) this.emailInput.value = settings.email;
            if (settings.tipoAnuncio) this.tipoAnuncioSelect.value = settings.tipoAnuncio;
            if (settings.interval) {
                this.intervalSlider.value = settings.interval;
                this.intervalValue.textContent = settings.interval;
            }
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    }

    validateInputs() {
        const email = this.emailInput.value.trim();

        if (!email) {
            this.addLog('error', 'E-mail é obrigatório');
            this.emailInput.focus();
            return false;
        }

        // Validação básica de e-mail
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.addLog('error', 'Formato de e-mail inválido');
            this.emailInput.focus();
            return false;
        }

        return true;
    }

    async loadRewardsConfig() {
        try {
            this.addLog('info', '⚙️ Carregando configurações de recompensa...');
            const config = await this.getConfigMissao();
            
            if (config) {
                this.rewardsConfig = config;
                this.updateRewardsDisplay(config);
                this.addLog('success', '✅ Configurações de recompensa carregadas');
            } else {
                this.addLog('warning', '⚠️ Não foi possível carregar configurações de recompensa');
            }
        } catch (error) {
            this.addLog('error', `❌ Erro ao carregar configurações: ${error.message}`);
        }
    }

    async start() {
        if (!this.validateInputs()) {
            return;
        }

        // Verificar se usuário foi resetado antes de iniciar
        const email = this.emailInput.value.trim();
        const resetCheck = await this.checkIfReset(email);
        
        if (resetCheck.isReset) {
            this.addLog('error', '❌ Sua conta foi resetada. Você precisa fazer login novamente.');
            alert('Sua conta foi resetada. Você precisa fazer login novamente para completar as tarefas.');
            window.location.href = '/';
            return;
        }

        this.isRunning = true;
        this.updateUI();
        
        const tipoAnuncio = this.tipoAnuncioSelect.value;
        
        this.addLog('info', `🚀 Iniciando simulação de anúncios para: ${email}`);
        this.addLog('info', `📺 Tipo de anúncio: ${tipoAnuncio === 'rewarded' ? 'Recompensado' : 'Intersticial'}`);
        this.addLog('info', `⏱️ Intervalo: ${this.intervalSlider.value} segundos`);

        // Primeira execução imediata
        await this.watchAd();

        // Configurar execução periódica
        const intervalMs = parseInt(this.intervalSlider.value) * 1000;
        this.intervalId = setInterval(() => {
            this.watchAd();
        }, intervalMs);
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.updateUI();
        this.addLog('info', '⏹️ Simulação parada pelo usuário');
    }

    async watchAdManual() {
        if (this.isRunning) {
            this.addLog('warning', '⚠️ Pare a simulação automática antes de usar o modo manual');
            return;
        }

        if (!this.validateInputs()) {
            return;
        }

        await this.watchAd();
    }

    async watchAd() {
        if (!this.isRunning && !this.validateInputs()) return;

        const email = this.emailInput.value.trim();
        const tipoAnuncio = this.tipoAnuncioSelect.value;
        const timestamp = new Date().toLocaleTimeString('pt-BR');
        
        this.stats.requests++;
        this.updateStats();

        try {
            this.addLog('info', `🔍 ${timestamp} - Buscando dados do usuário...`);
            
            // 1. Buscar usuário atual
            const userData = await this.buscarUsuario(email);
            
            if (!userData || userData.count === 0) {
                throw new Error('Usuário não encontrado');
            }

            const usuario = userData.results[0];
            const saldoAtual = parseFloat(usuario.saldo);
            
            this.addLog('success', `💰 ${timestamp} - Saldo atual: R$ ${saldoAtual.toFixed(5)}`);
            this.updateUserInfo(usuario);

            // 2. Calcular recompensa
            const recompensa = this.calculateReward(tipoAnuncio);
            const novoSaldo = saldoAtual + recompensa;

            this.addLog('info', `🎯 ${timestamp} - Assistindo anúncio ${tipoAnuncio === 'rewarded' ? 'recompensado' : 'intersticial'}...`);
            this.addLog('money', `💵 ${timestamp} - Recompensa: R$ ${recompensa.toFixed(5)}`);

            // 3. Atualizar saldo do usuário
            const updateResult = await this.atualizarUsuario(usuario.id, novoSaldo.toFixed(5), 1);
            
            if (updateResult && updateResult.sucesso) {
                this.addLog('success', `✅ ${timestamp} - Saldo atualizado: R$ ${novoSaldo.toFixed(5)}`);
            } else {
                throw new Error('Falha ao atualizar saldo do usuário');
            }

            // 4. Atualizar missão
            const missionResult = await this.atualizarMissao(email, recompensa.toFixed(5));
            
            if (missionResult && missionResult.sucesso) {
                this.addLog('success', `🎯 ${timestamp} - Missão atualizada`);
                
                // Atualizar display da missão
                if (missionResult.progresso && missionResult.meta) {
                    this.updateMissionDisplay({
                        progresso: missionResult.progresso,
                        meta: missionResult.meta,
                        ultima_missao: missionResult.ultima_missao || new Date().toISOString().split('T')[0]
                    });
                }
            } else {
                this.addLog('warning', `⚠️ ${timestamp} - Falha ao atualizar missão`);
            }

            // 5. Buscar dados atualizados
            const updatedUserData = await this.buscarUsuario(email);
            if (updatedUserData && updatedUserData.count > 0) {
                this.updateUserInfo(updatedUserData.results[0]);
            }

            this.stats.successes++;
            this.stats.totalEarnings += recompensa;
            
        } catch (error) {
            this.handleError(error, timestamp);
        }
        
        this.updateStats();
    }

    calculateReward(tipoAnuncio) {
        if (!this.rewardsConfig) {
            // Valores padrão se não conseguir carregar configurações
            return tipoAnuncio === 'rewarded' ? 
                0.001 + (Math.random() * 0.004) : // 0.001 a 0.005
                0.002; // valor fixo para intersticial
        }

        switch (tipoAnuncio) {
            case 'rewarded':
                const min = parseFloat(this.rewardsConfig.rewarded_min || 0.001);
                const max = parseFloat(this.rewardsConfig.rewarded_max || 0.005);
                return min + (Math.random() * (max - min));
            case 'interstitial':
                return parseFloat(this.rewardsConfig.interstitial_reward || 0.002);
            default:
                return 0.001;
        }
    }

    async buscarUsuario(email) {
        try {
            const response = await fetch('/api/buscar_usuario', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Host': 'pixassistindo.thm.app.br',
                    'User-Agent': 'okhttp/4.11.0'
                },
                body: JSON.stringify({ email: email })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Erro ao buscar usuário: ${error.message}`);
        }
    }

    async checkIfReset(email) {
        try {
            // Buscar userId do localStorage
            const userId = localStorage.getItem('user_id');
            
            if (!userId) {
                return { isReset: true };
            }
            
            // Consultar API do Railway para verificar status
            const response = await fetch(`/api/stats/user/${userId}`);
            
            if (!response.ok) {
                console.error('[CHECK RESET] Erro ao verificar status:', response.status);
                return { isReset: false }; // Não bloquear se API falhar
            }
            
            const data = await response.json();
            console.log('[CHECK RESET] Dados do usuário:', data);
            
            // Verificar se foi resetado (time_remaining = 0 e is_expired = true)
            const isReset = data.time_remaining === 0 && data.is_expired === true;
            
            return { isReset, data };
        } catch (error) {
            console.error('[CHECK RESET] Erro:', error);
            return { isReset: false }; // Não bloquear se houver erro
        }
    }

    async atualizarUsuario(id, saldo, views) {
        try {
            const response = await fetch('/api/atualizar_usuario', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Host': 'pixassistindo.thm.app.br',
                    'User-Agent': 'okhttp/4.11.0'
                },
                body: JSON.stringify({
                    id: id.toString(),
                    saldo: saldo,
                    views: views
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Erro ao atualizar usuário: ${error.message}`);
        }
    }

    async atualizarMissao(email, valorPago) {
        try {
            const response = await fetch('/api/atualizar_missao', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Host': 'pixassistindo.thm.app.br',
                    'User-Agent': 'okhttp/4.11.0'
                },
                body: JSON.stringify({
                    email: email,
                    valor_pago: valorPago
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Erro ao atualizar missão: ${error.message}`);
        }
    }

    async getConfigMissao() {
        try {
            const response = await fetch('/api/get_config_missao', {
                method: 'GET',
                headers: {
                    'Host': 'pixassistindo.thm.app.br',
                    'User-Agent': 'okhttp/4.11.0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Erro ao obter configurações: ${error.message}`);
        }
    }

    handleError(error, timestamp) {
        this.stats.errors++;
        
        let errorMessage = error.message;
        
        // Tratar erros específicos
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Erro de conectividade. Verifique sua conexão com a internet.';
        } else if (error.message.includes('CORS')) {
            errorMessage = 'Erro de CORS. O servidor pode não permitir requisições do navegador.';
        }
        
        this.addLog('error', `❌ ${timestamp} - ${errorMessage}`);
        
        // Se muitos erros consecutivos, sugerir parar
        if (this.stats.errors > 3 && this.stats.successes === 0) {
            this.addLog('warning', '⚠️ Muitos erros detectados. Verifique as configurações ou pare o processo.');
        }
    }

    updateUserInfo(userData) {
        if (!userData) return;

        this.currentUserData = userData;
        
        const userInfoHtml = `
            <div class="user-info-grid">
                <div class="user-info-item">
                    <div class="user-info-label">ID</div>
                    <div class="user-info-value">${userData.id || 'N/A'}</div>
                </div>
                <div class="user-info-item">
                    <div class="user-info-label">E-mail</div>
                    <div class="user-info-value">${userData.email || 'N/A'}</div>
                </div>
                <div class="user-info-item">
                    <div class="user-info-label">Saldo</div>
                    <div class="user-info-value">R$ ${parseFloat(userData.saldo || 0).toFixed(5)}</div>
                </div>
                <div class="user-info-item">
                    <div class="user-info-label">Device ID</div>
                    <div class="user-info-value">${userData.device_id || 'N/A'}</div>
                </div>
                <div class="user-info-item">
                    <div class="user-info-label">Última Recompensa</div>
                    <div class="user-info-value">${userData.ultima_recompensa || 'Nunca'}</div>
                </div>
                <div class="user-info-item">
                    <div class="user-info-label">Status</div>
                    <div class="user-info-value">${userData.banido ? 'Banido' : 'Ativo'}</div>
                </div>
            </div>
        `;
        
        this.userInfoContainer.innerHTML = userInfoHtml;

        // Atualizar missão se disponível
        if (userData.progresso_missao2 !== undefined) {
            this.updateMissionDisplay({
                progresso: userData.progresso_missao2,
                meta: userData.meta_missao2
            });
        }
    }

    updateMissionDisplay(missionData) {
        const progresso = parseFloat(missionData.progresso || 0);
        const meta = parseFloat(missionData.meta || 0.5);
        const percentage = meta > 0 ? (progresso / meta) * 100 : 0;

        const missionHtml = `
            <div class="mission-grid">
                <div class="mission-item">
                    <div class="mission-label">Progresso Atual</div>
                    <div class="mission-value">R$ ${progresso.toFixed(5)}</div>
                </div>
                <div class="mission-item">
                    <div class="mission-label">Meta da Missão</div>
                    <div class="mission-value">R$ ${meta.toFixed(5)}</div>
                </div>
                <div class="mission-item">
                    <div class="mission-label">Percentual</div>
                    <div class="mission-value">${percentage.toFixed(1)}%</div>
                </div>
                <div class="mission-item">
                    <div class="mission-label">Última Atualização</div>
                    <div class="mission-value">${missionData.ultima_missao || 'Hoje'}</div>
                </div>
            </div>
            <div class="mission-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="progress-text">
                    Faltam R$ ${Math.max(0, meta - progresso).toFixed(5)} para completar a missão
                </div>
            </div>
        `;
        
        this.missionContainer.innerHTML = missionHtml;
    }

    updateRewardsDisplay(rewardsData) {
        const rewardsHtml = `
            <div class="rewards-grid">
                <div class="rewards-item">
                    <div class="rewards-label">Recompensa Mínima (Rewarded)</div>
                    <div class="rewards-value">R$ ${parseFloat(rewardsData.rewarded_min || 0).toFixed(5)}</div>
                </div>
                <div class="rewards-item">
                    <div class="rewards-label">Recompensa Máxima (Rewarded)</div>
                    <div class="rewards-value">R$ ${parseFloat(rewardsData.rewarded_max || 0).toFixed(5)}</div>
                </div>
                <div class="rewards-item">
                    <div class="rewards-label">Recompensa Intersticial</div>
                    <div class="rewards-value">R$ ${parseFloat(rewardsData.interstitial_reward || 0).toFixed(5)}</div>
                </div>
                <div class="rewards-item">
                    <div class="rewards-label">Recompensa Login</div>
                    <div class="rewards-value">R$ ${parseFloat(rewardsData.recompensa_login || 0).toFixed(5)}</div>
                </div>
                <div class="rewards-item">
                    <div class="rewards-label">Nome da Missão</div>
                    <div class="rewards-value">${rewardsData.nome_missao || 'Missão Padrão'}</div>
                </div>
            </div>
        `;
        
        this.rewardsContainer.innerHTML = rewardsHtml;
    }

    addLog(type, message) {
        // Remover mensagem de log vazio se existir
        const emptyLog = this.logContainer.querySelector('.log-empty');
        if (emptyLog) {
            emptyLog.remove();
        }

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = message;

        this.logContainer.appendChild(logEntry);

        // Limitar número de logs (manter últimos 100)
        const logs = this.logContainer.querySelectorAll('.log-entry');
        if (logs.length > 100) {
            logs[0].remove();
        }

        // Auto scroll se habilitado
        if (this.autoScroll) {
            this.logContainer.scrollTop = this.logContainer.scrollHeight;
        }
    }

    clearLog() {
        this.logContainer.innerHTML = `
            <div class="log-empty">
                <span class="log-empty-icon">📝</span>
                <p>Log limpo. Clique em "Iniciar Simulação" para começar novamente.</p>
            </div>
        `;
        
        // Reset stats
        this.stats = {
            requests: 0,
            successes: 0,
            errors: 0,
            totalEarnings: this.stats.totalEarnings // Manter ganhos totais
        };
        this.updateStats();
    }

    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        this.autoScrollBtn.classList.toggle('active', this.autoScroll);
        this.autoScrollBtn.textContent = this.autoScroll ? 'Auto Scroll' : 'Manual Scroll';
    }

    async startSessionTimer() {
        const timerElement = document.getElementById('sessionTimer');
        if (!timerElement) return;
        
        // Buscar userId da URL ou localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId') || localStorage.getItem('user_id');
        
        if (!userId) {
            console.error('[TIMER] userId não encontrado na URL ou localStorage');
            timerElement.textContent = '00:00:00';
            return;
        }
        
        console.log('[TIMER] Usando userId:', userId);
        console.log('[TIMER] API de verificação:', `https://monetag-postback-server-production.up.railway.app/api/stats/user/${userId}`);
        
        const updateTimer = async () => {
            try {
                // Buscar time_remaining do servidor Railway
                const response = await fetch(`https://monetag-postback-server-production.up.railway.app/api/stats/user/${userId}`);
                const data = await response.json();
                
                const timeRemaining = data.time_remaining || 0;
                const impressions = data.total_impressions || 0;
                const clicks = data.total_clicks || 0;
                const sessionExpired = data.session_expired || false;
                
                console.log(`[PIX TIMER] Dados recebidos: ${impressions} impressões, ${clicks} cliques, ${timeRemaining}s restantes, expirado=${sessionExpired}`);
                
                const hours = Math.floor(timeRemaining / 3600);
                const minutes = Math.floor((timeRemaining % 3600) / 60);
                const seconds = timeRemaining % 60;
                
                timerElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                
                // Se dados foram resetados (impressões e cliques voltaram para 0) OU sessão expirou, redirecionar
                if ((impressions === 0 && clicks === 0) || sessionExpired) {
                    console.log('[PIX] Dados resetados! Redirecionando para Young Money...');
                    localStorage.removeItem('user_logged_in');
                    localStorage.removeItem('user_id');
                    localStorage.removeItem('user_email');
                    window.location.href = '/';
                    return;
                }
            } catch (error) {
                console.error('[TIMER] Erro ao buscar time_remaining:', error);
                timerElement.textContent = '--:--:--';
            }
        };
        
        // Atualizar imediatamente e depois a cada 1 hora
        updateTimer();
        this.timerIntervalId = setInterval(updateTimer, 3600000); // 3600000ms = 1 hora
    }

    updateUI() {
        // Atualizar botões
        this.startBtn.disabled = this.isRunning;
        this.stopBtn.disabled = !this.isRunning;
        
        // Atualizar inputs
        this.emailInput.disabled = this.isRunning;
        this.tipoAnuncioSelect.disabled = this.isRunning;
        this.intervalSlider.disabled = this.isRunning;
        
        // Atualizar status
        if (this.isRunning) {
            this.statusDot.className = 'status-dot running';
            this.statusText.textContent = 'Executando';
        } else {
            this.statusDot.className = 'status-dot stopped';
            this.statusText.textContent = 'Parado';
        }
    }

    async initializeSessionSecurity() {
        console.log('[SECURITY] Inicializando segurança de sessão...');
        
        const initialized = await this.sessionSecurity.initialize();
        
        if (!initialized) {
            console.log('[SECURITY] ❌ Falha ao inicializar segurança - acesso bloqueado');
            // O SessionSecurity já bloqueou o acesso
            throw new Error('Sessão bloqueada');
        }
        
        console.log('[SECURITY] ✅ Segurança de sessão ativada');
    }

    async validateAccess() {
        console.log('[VALIDAÇÃO] Verificando se usuário completou tarefas...');
        
        // Pegar userId da URL ou localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const userIdFromUrl = urlParams.get('userId');
        const storedUserId = localStorage.getItem('user_id');
        const userId = userIdFromUrl || storedUserId;
        
        if (!userId) {
            console.log('[VALIDAÇÃO] ❌ User ID não encontrado - redirecionando para login');
            alert('Você precisa fazer login primeiro!');
            window.location.href = '/';
            return;
        }
        
        try {
            // Buscar stats do usuário no backend usando userId
            const apiUrl = `https://monetag-postback-server-production.up.railway.app/api/stats/user/${userId}`;
            console.log('[VALIDAÇÃO] Consultando API:', apiUrl);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`Erro ao buscar stats: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('[VALIDAÇÃO] Resposta da API:', data);
            
            // Verificar se completou as tarefas (20 impressões + 2 cliques)
            const impressions = data.total_impressions || 0;
            const clicks = data.total_clicks || 0;
            
            console.log(`[VALIDAÇÃO] Progresso: ${impressions}/20 impressões, ${clicks}/2 cliques`);
            
            if (impressions < 20 || clicks < 2) {
                console.log(`[VALIDAÇÃO] ❌ Tarefas incompletas`);
                alert(`Você precisa completar as tarefas primeiro!\n\nProgresso atual:\n- Impressões: ${impressions}/20\n- Cliques: ${clicks}/2`);
                window.location.href = '/';
                return;
            }
            
            console.log('[VALIDAÇÃO] ✅ Tarefas completas - acesso permitido');
        } catch (error) {
            console.error('[VALIDAÇÃO] ❌ Erro ao validar acesso:', error);
            alert('Erro ao verificar seu progresso. Tente novamente.');
            window.location.href = '/';
        }
    }
    
    updateStats() {
        this.requestCount.textContent = this.stats.requests;
        this.successCount.textContent = this.stats.successes;
        this.errorCount.textContent = this.stats.errors;
        this.totalEarnings.textContent = `R$ ${this.stats.totalEarnings.toFixed(5)}`;
    }
}

// Inicializar aplicação quando DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    new PixAssistindoManager();
});

// Service Worker para PWA (opcional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registrado com sucesso:', registration);
            })
            .catch(registrationError => {
                console.log('Falha no registro do SW:', registrationError);
            });
    });
}
