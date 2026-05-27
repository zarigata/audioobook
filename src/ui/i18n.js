export default {
  app: {
    title: 'AudiooBook',
    subtitle: 'Transforme seus textos em áudio',
    footer: 'Tudo processado no seu navegador. Nenhum arquivo é enviado para servidores.',
  },

  upload: {
    title: 'Arraste seu arquivo aqui',
    subtitle: 'ou clique para selecionar',
    formats: 'PDF, EPUB, TXT, DOCX, HTML, RTF, MD — até 100MB',
    changeFile: 'Clique para trocar de arquivo',
    orPaste: 'ou cole o texto aqui',
  },

  mode: {
    fast: '⚡ Rápido (voz do navegador)',
    fastDesc: 'Sintese rápida usando as vozes do navegador. Somente para ouvir.',
    quality: '🎙 Qualidade (voz neural)',
    qualityDesc: 'Voz neural Piper em português. Gera MP3 para baixar.',
    select: 'Escolha o modo de síntese',
  },

  voice: {
    select: 'Escolha a voz',
    preview: 'Ouvir amostra',
    stopPreview: 'Parar amostra',
    loading: 'Carregando vozes...',
    none: 'Nenhuma voz disponível',
    downloading: 'Baixando modelo de voz...',
    downloadProgress: 'Baixando: {percent}%',
    downloadComplete: 'Modelo carregado!',
    faber: 'Faber (masculino, BR)',
    edresson: 'Edresson (masculino, BR)',
    tugao: 'Tugão (masculino, PT)',
  },

  preview: {
    title: 'Prévia do texto',
    words: '{count} palavras',
    duration: '~{duration} de áudio',
    segments: '{count} segmentos',
    showMore: 'Mostrar mais',
    showLess: 'Mostrar menos',
  },

  actions: {
    generate: '🎙 Gerar áudio',
    generating: 'Gerando...',
    play: '▶ Reproduzir',
    pause: '⏸ Pausar',
    stop: '⏹ Parar',
    skipBack: '⏪ -10s',
    skipForward: '⏩ +10s',
    download: '⬇ Baixar MP3',
    downloadWav: '⬇ Baixar WAV',
    newFile: '📄 Novo arquivo',
    cancel: '✕ Cancelar',
    retry: '🔄 Tentar novamente',
  },

  progress: {
    parsing: 'Extraindo texto...',
    segmenting: 'Segmentando texto...',
    generating: 'Gerando segmento {current} de {total}...',
    encoding: 'Codificando áudio...',
    complete: 'Concluído!',
    canceled: 'Cancelado.',
    error: 'Erro: {message}',
    eta: 'Tempo restante: ~{eta}',
    failedSegment: 'Segmento {index} falhou, tentando novamente...',
  },

  speed: {
    label: 'Velocidade',
  },

  quality: {
    label: 'Qualidade MP3',
    low: '64 kbps (menor arquivo)',
    medium: '128 kbps (recomendado)',
    high: '192 kbps (alta)',
    max: '256 kbps (máxima)',
  },

  segments: {
    title: 'Segmentos',
    current: 'Reproduzindo',
    played: 'Concluído',
    pending: 'Pendente',
  },

  player: {
    currentTime: '{time}',
    totalTime: '/ {time}',
    segmentOf: 'Segmento {current} de {total}',
  },

  toast: {
    fileLoaded: 'Arquivo carregado com sucesso!',
    generationStarted: 'Geração de áudio iniciada...',
    generationComplete: 'Áudio gerado com sucesso!',
    downloadStarted: 'Download iniciado...',
    error: 'Erro: {message}',
    voiceDownloaded: 'Modelo de voz baixado!',
    segmentFailed: 'Segmento falhou, tentando novamente...',
  },

  keyboard: {
    title: 'Atalhos de teclado',
    space: 'Reproduzir / Pausar',
    leftRight: 'Voltar / Avançar 10s',
    upDown: 'Velocidade ±0.25x',
    m: 'Modo escuro',
  },

  darkMode: {
    label: '🌙 Modo escuro',
    lightLabel: '☀️ Modo claro',
  },

  errors: {
    noFile: 'Nenhum arquivo selecionado.',
    fileTooLarge: 'Arquivo muito grande ({size}). O limite é 100MB.',
    fileEmpty: 'O arquivo está vazio.',
    formatUnsupported: 'Formato não suportado: "{format}". Use PDF, EPUB, TXT, DOCX, HTML, RTF ou MD.',
    noText: 'Não foi possível extrair texto do arquivo.',
    noVoice: 'Nenhuma voz em português disponível no navegador.',
    ttsError: 'Erro na síntese de voz: {message}',
    modelError: 'Erro ao carregar modelo: {message}',
    encodeError: 'Erro ao codificar áudio: {message}',
    browserTtsNoExport: 'O modo rápido não suporta download de MP3. Use o modo qualidade.',
  },
};
