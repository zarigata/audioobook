// Portuguese (pt-BR) UI strings — all user-visible text in one place

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
  },

  mode: {
    fast: 'Rápido (voz do navegador)',
    fastDesc: 'Sintese rápida usando as vozes do navegador. Somente para ouvir.',
    quality: 'Qualidade (voz neural)',
    qualityDesc: 'Voz neural Piper em português. Gera MP3 para baixar.',
    select: 'Escolha o modo de síntese',
  },

  voice: {
    select: 'Escolha a voz',
    loading: 'Carregando vozes...',
    none: 'Nenhuma voz disponível',
    downloading: 'Baixando modelo de voz...',
    downloadProgress: 'Baixando: {percent}%',
    downloadComplete: 'Modelo carregado!',
  },

  actions: {
    generate: 'Gerar áudio',
    generating: 'Gerando...',
    play: '▶ Reproduzir',
    pause: '⏸ Pausar',
    stop: '⏹ Parar',
    download: '⬇ Baixar MP3',
    downloadWav: '⬇ Baixar WAV',
    newFile: '📄 Novo arquivo',
  },

  progress: {
    parsing: 'Extraindo texto...',
    segmenting: 'Segmentando texto...',
    generating: 'Gerando segmento {current} de {total}...',
    encoding: 'Codificando áudio...',
    complete: 'Concluído!',
    canceled: 'Cancelado.',
    error: 'Erro: {message}',
    segments: '{count} segmentos encontrados',
    duration: 'Duração estimada: {duration}',
  },

  speed: {
    label: 'Velocidade',
    slow: 'Lento',
    normal: 'Normal',
    fast: 'Rápido',
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
