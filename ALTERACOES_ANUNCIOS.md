# 🎯 Alterações no Sistema de Anúncios

## 📋 Resumo das Alterações

Foram realizadas **3 alterações principais** no sistema de anúncios e missões diárias:

1. ✅ **Substituição do script de anúncio** (Monetag)
2. ✅ **Ajuste dos limites de missão diária**
3. ✅ **Implementação de bloqueio de clicks**

---

## 1️⃣ Substituição do Script de Anúncio

### Arquivo Modificado
`/public/assets/index-Bt8lmjj0.js` (código React ofuscado)

### Alterações

**Antes:**
```javascript
Ud="10317091"
Ld="show_10317091"
```

**Depois:**
```javascript
Ud="10873424"
Ld="show_10873424"
```

### Resultado

O script do Monetag agora usa:
```html
<script src='//libtl.com/sdk.js' data-zone='10873424' data-sdk='show_10873424'></script>
```

---

## 2️⃣ Ajuste dos Limites de Missão Diária

### Arquivo Modificado
`/public/assets/index-Bt8lmjj0.js` (código React ofuscado)

### Alterações

**Antes:**
```javascript
$u=20  // Impressões (mantido)
Yu=8   // Clicks (alterado)
```

**Depois:**
```javascript
$u=20  // Impressões ✅
Yu=2   // Clicks ✅
```

### Resultado

Agora o usuário precisa de:
- ✅ **20 impressões** (visualizações do anúncio)
- ✅ **2 clicks** (em vez de 8)

---

## 3️⃣ Implementação de Bloqueio de Clicks

### Arquivo Modificado
`/public/index.html`

### Funcionalidade Adicionada

**Script de Bloqueio Global:**

```javascript
(function() {
  let clickCount = 0;
  const MAX_CLICKS = 2;
  let isBlocked = false;
  
  // Interceptar TODOS os clicks no documento
  document.addEventListener('click', function(e) {
    const currentClicks = parseInt(localStorage.getItem('ad_clicks_count') || '0');
    
    if (currentClicks >= MAX_CLICKS && !isBlocked) {
      // Bloquear evento
      e.stopPropagation();
      e.preventDefault();
      
      // Criar overlay de bloqueio
      // ... (código do overlay)
      
      isBlocked = true;
      return false;
    }
  }, true); // Capture phase
})();
```

### Como Funciona

1. **Interceptação Global**
   - Usa `addEventListener` com `capture: true`
   - Intercepta **TODOS os clicks** antes que cheguem aos elementos
   - Funciona em **qualquer parte** do anúncio (não só no botão)

2. **Verificação de Limite**
   - Lê `ad_clicks_count` do localStorage
   - Compara com `MAX_CLICKS = 2`
   - Se atingiu o limite, bloqueia

3. **Bloqueio Visual**
   - Cria overlay escuro sobre toda a tela
   - Mostra mensagem informativa
   - Impede qualquer interação adicional

4. **Mensagem ao Usuário**
   ```
   ⚠️ Limite Atingido
   
   Você já realizou 2 clicks no anúncio de hoje.
   
   Volte amanhã para continuar!
   ```

---

## 🎯 Comportamento Esperado

### Fluxo Normal

1. **Usuário acessa o painel**
   - Vê missões diárias
   - Precisa de 20 impressões e 2 clicks

2. **Primeiro click no anúncio**
   - ✅ Contabilizado
   - ✅ Anúncio continua funcionando
   - Progresso: 1/2 clicks

3. **Segundo click no anúncio**
   - ✅ Contabilizado
   - ✅ Missão completa (2/2 clicks)
   - Sistema marca tarefa como concluída

4. **Tentativa de terceiro click**
   - ❌ **BLOQUEADO** pelo script
   - ❌ Overlay aparece
   - ❌ Nenhuma interação permitida
   - Mensagem exibida ao usuário

### Áreas Bloqueadas

O bloqueio funciona em **TODA a área clicável** do anúncio:

- ✅ Imagem do anúncio
- ✅ Texto do anúncio
- ✅ Botão "Continuar"
- ✅ Qualquer parte do iframe/container
- ✅ Links dentro do anúncio

---

## 🔧 Detalhes Técnicos

### Por Que Usar Capture Phase?

```javascript
document.addEventListener('click', handler, true);
                                            ^^^^
                                            capture: true
```

**Motivo:**
- Eventos no DOM têm 3 fases: **Capture → Target → Bubble**
- Usando `capture: true`, interceptamos o evento **ANTES** que chegue ao elemento alvo
- Isso garante que **nenhum** handler do anúncio seja executado após o limite

### Por Que Não Modificar o Código React Diretamente?

**Razões:**
1. Código está **ofuscado** e minificado
2. Difícil de localizar a função exata de click
3. Risco de quebrar a aplicação
4. Solução global é mais **robusta** e **independente**

### Vantagens da Abordagem Atual

✅ **Independente do código React**
- Funciona mesmo se o React mudar
- Não depende de variáveis internas

✅ **Bloqueio total**
- Intercepta TODOS os clicks
- Não importa onde o usuário clique

✅ **Feedback visual claro**
- Usuário entende por que não pode clicar
- Mensagem informativa e amigável

✅ **Fácil de manter**
- Código simples e legível
- Fácil de ajustar o limite (MAX_CLICKS)

---

## 📊 Valores Configuráveis

### Limite de Clicks

**Localização:** `/public/index.html` (linha ~188)

```javascript
const MAX_CLICKS = 2;  // Altere aqui para mudar o limite
```

### Limite de Impressões

**Localização:** `/public/assets/index-Bt8lmjj0.js`

```javascript
$u=20  // Altere aqui (requer rebuild do React)
```

### Limite de Clicks (React)

**Localização:** `/public/assets/index-Bt8lmjj0.js`

```javascript
Yu=2   // Altere aqui (requer rebuild do React)
```

---

## 🧪 Como Testar

### Teste 1: Verificar Script de Anúncio

1. Acesse o painel
2. Abra DevTools (F12)
3. Vá em "Network"
4. Procure por `sdk.js`
5. Verifique se a URL contém `data-zone=10873424`

### Teste 2: Verificar Limites

1. Acesse o painel
2. Vá para missões diárias
3. Verifique se mostra:
   - "0/20 impressões"
   - "0/2 clicks"

### Teste 3: Testar Bloqueio de Clicks

1. Acesse o painel
2. Vá para tela de anúncio
3. Clique **1 vez** em qualquer parte
   - ✅ Deve funcionar normalmente
4. Clique **2ª vez** em qualquer parte
   - ✅ Deve funcionar normalmente
   - ✅ Missão deve ser marcada como completa
5. Tente clicar **3ª vez** em qualquer parte
   - ❌ Deve ser bloqueado
   - ❌ Overlay deve aparecer
   - ❌ Mensagem deve ser exibida

### Teste 4: Verificar Console

Abra o console (F12) e procure por:

```
[CLICK BLOCKER] Sistema de bloqueio de clicks ativado (máximo: 2)
```

Ao tentar o terceiro click:

```
[CLICK BLOCKER] Limite de clicks atingido! Bloqueando interações...
```

---

## 🐛 Solução de Problemas

### Problema: Bloqueio não funciona

**Possíveis causas:**
1. localStorage bloqueado (modo anônimo)
2. JavaScript desabilitado
3. Cache do navegador

**Solução:**
1. Limpar cache (Ctrl+Shift+Delete)
2. Recarregar página (Ctrl+F5)
3. Verificar console para erros

### Problema: Limite não atualizado

**Causa:** Código React em cache

**Solução:**
1. Fazer hard refresh (Ctrl+F5)
2. Limpar cache do navegador
3. Verificar se o arquivo JS foi atualizado

### Problema: Overlay não aparece

**Causa:** CSS não carregado ou z-index baixo

**Solução:**
1. Verificar console para erros
2. Inspecionar elemento overlay
3. Verificar se `z-index: 999999` está aplicado

---

## 📝 Changelog

### Versão 1.1 (Atual)

**Data:** Dezembro 2025

**Alterações:**
- ✅ Script Monetag atualizado (zona 10873424)
- ✅ Limite de clicks reduzido para 2
- ✅ Bloqueio global de clicks implementado
- ✅ Overlay de limite adicionado

### Versão 1.0 (Anterior)

**Configuração:**
- Script Monetag zona 10317091
- Limite de 8 clicks
- Sem bloqueio de terceiro click

---

## 🔗 Arquivos Modificados

1. **`/public/assets/index-Bt8lmjj0.js`**
   - Linha com `Ud="10317091"` → `Ud="10873424"`
   - Linha com `Ld="show_10317091"` → `Ld="show_10873424"`
   - Linha com `Yu=8` → `Yu=2`

2. **`/public/index.html`**
   - Adicionado script de bloqueio (linhas 184-263)

---

## ✅ Checklist de Validação

- [x] Script de anúncio substituído
- [x] Limite de clicks ajustado para 2
- [x] Limite de impressões mantido em 20
- [x] Bloqueio de terceiro click implementado
- [x] Overlay de mensagem funcionando
- [x] Código commitado no GitHub
- [x] Documentação criada

---

## 🎯 Próximos Passos

1. **Deploy no Render.com**
   - Push já foi feito para o GitHub
   - Render vai fazer deploy automático

2. **Testar em Produção**
   - Acessar URL do Render
   - Validar todos os comportamentos
   - Verificar console para logs

3. **Monitorar**
   - Acompanhar logs do Render
   - Verificar se anúncios estão carregando
   - Validar contagem de clicks

---

**Desenvolvido com ❤️ para o Graninha Bot**

**Sistema de anúncios otimizado e protegido contra clicks excessivos**
