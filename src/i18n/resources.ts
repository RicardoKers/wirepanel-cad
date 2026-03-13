export const supportedLanguages = ["en", "pt-BR"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export const resources = {
  en: {
    translation: {
      language: {
        label: "Language",
        english: "English",
        portugueseBrazil: "Portuguese (Brazil)"
      },
      toolbar: {
        tools: {
          select: "Select",
          line: "Line",
          potential: "Potential",
          circle: "Circle",
          arc: "Arc",
          text: "Text",
          pin: "Pin",
          pan: "Pan"
        },
        actions: {
          fitToPage: "Fit to Page",
          downloadProject: "Download Project",
          uploadProject: "Upload Project",
          help: "Help",
          exportPdf: "Export PDF"
        }
      },
      rightPanel: {
        tabsAriaLabel: "Inspector tabs",
        tabs: {
          properties: "Properties",
          potentials: "Potentials",
          layers: "Layers",
          settings: "Settings"
        }
      },
      settings: {
        sections: {
          language: "Application",
          pdf: "PDF Settings",
          grid: "Grid",
          pins: "Pins"
        },
        fields: {
          project: "Project",
          drawing: "Drawing",
          author: "Author",
          sheet: "Sheet",
          orientation: "Orientation",
          portrait: "Portrait",
          landscape: "Landscape",
          marginLeft: "Margin Left",
          marginRight: "Margin Right",
          marginTop: "Margin Top",
          marginBottom: "Margin Bottom",
          snap: "Snap",
          size: "Size",
          color: "Color",
          showConnectionX: "Show connection X"
        }
      },
      components: {
        title: "Components",
        appLibrary: "App Library",
        projectComponents: "Project Components",
        saveToProject: "Save to Project",
        defaultName: "Component {{number}}",
        emptyAppLibrary: "No built-in components yet.",
        emptyProjectComponents: "No project components yet.",
        placementHint: "Click or drag a component onto the canvas to place it. Hold Alt for contain select.",
        delete: "Delete",
        exportToAppLibrary: "Download JSON",
        exportSuccess: "Component JSON downloaded: {{fileName}}",
        exportFailed: "Could not download the component JSON.",
        exportFilePrompt: "Component JSON file name",
        exportCategoryPrompt: "Category",
        exportHelp: "Downloaded files can be added to src/library/components and bundled in the next build.",
        searchPlaceholder: "Search components",
        sourceApp: "App",
        sourceProject: "Project",
        uncategorized: "Uncategorized",
        noMatches: "No components match the current filter."
      },
      layers: {
        title: "Layers",
        show: "Show",
        hide: "Hide",
        lock: "Lock",
        edit: "Edit",
        deleteShort: "Del"
      },
      potentials: {
        title: "Potentials",
        renumber: "Renumber",
        empty: "No potentials yet.",
        unnamed: "Unnamed",
        noSize: "No size",
        sizeValue: "{{value}} mm\u00B2",
        prefix: "P{{number}}"
      },
      properties: {
        title: "Properties",
        empty: "Select an object to edit properties.",
        activeLayer: "Active layer: {{name}}",
        delete: "Delete",
        rotateMinus15: "Rotate -15 deg",
        rotatePlus15: "Rotate +15 deg",
        mirrorHorizontal: "Mirror Horizontal",
        mirrorVertical: "Mirror Vertical",
        alignLeft: "Align Left",
        alignCenterX: "Align Center X",
        alignRight: "Align Right",
        alignTop: "Align Top",
        alignCenterY: "Align Center Y",
        alignBottom: "Align Bottom",
        moveX: "Move X",
        moveY: "Move Y",
        applyMove: "Apply Move",
        layer: "Layer",
        line: "Line",
        lineWidth: "Line width",
        lineStyle: "Line style",
        continuous: "Continuous",
        dashed: "Dashed",
        dotted: "Dotted",
        number: "Number",
        name: "Name",
        diameterMm2: "Diameter (mm\u00B2)",
        x1: "X1",
        y1: "Y1",
        x2: "X2",
        y2: "Y2",
        cx: "CX",
        cy: "CY",
        r: "R",
        start: "Start",
        end: "End",
        x: "X",
        y: "Y",
        text: "Text",
        size: "Size",
        link: "Link",
        target: "Target",
        pinX: "Pin X",
        pinY: "Pin Y",
        tag: "Tag",
        tagX: "Tag X",
        tagY: "Tag Y",
        tagSize: "Tag size",
        originX: "Origin X",
        originY: "Origin Y"
      },
      app: {
        pagesAriaLabel: "Pages",
        pageLabel: "Page {{number}}",
        layerLabel: "Layer {{number}}",
        deletePage: "Delete page",
        groupSelection: "Group selection",
        ungroup: "Ungroup",
        moveToLayer: "Move to layer",
        exportFilename: "cad-export.pdf",
        newText: "Text",
        newPin: "Pin"
      }
    }
  },
  "pt-BR": {
    translation: {
      language: {
        label: "Idioma",
        english: "Ingl\u00EAs",
        portugueseBrazil: "Portugu\u00EAs (Brasil)"
      },
      toolbar: {
        tools: {
          select: "Selecionar",
          line: "Linha",
          potential: "Potencial",
          circle: "C\u00EDrculo",
          arc: "Arco",
          text: "Texto",
          pin: "Pino",
          pan: "Mover"
        },
        actions: {
          fitToPage: "Ajustar a p\u00E1gina",
          downloadProject: "Baixar Projeto",
          uploadProject: "Carregar Projeto",
          help: "Ajuda",
          exportPdf: "Exportar PDF"
        }
      },
      rightPanel: {
        tabsAriaLabel: "Abas do inspetor",
        tabs: {
          properties: "Propriedades",
          potentials: "Potenciais",
          layers: "Camadas",
          settings: "Configura\u00E7\u00F5es"
        }
      },
      settings: {
        sections: {
          language: "Aplica\u00E7\u00E3o",
          pdf: "Configura\u00E7\u00F5es do PDF",
          grid: "Grade",
          pins: "Pinos"
        },
        fields: {
          project: "Projeto",
          drawing: "Desenho",
          author: "Autor",
          sheet: "Folha",
          orientation: "Orienta\u00E7\u00E3o",
          portrait: "Retrato",
          landscape: "Paisagem",
          marginLeft: "Margem Esquerda",
          marginRight: "Margem Direita",
          marginTop: "Margem Superior",
          marginBottom: "Margem Inferior",
          snap: "Snap",
          size: "Tamanho",
          color: "Cor",
          showConnectionX: "Mostrar X de conex\u00E3o"
        }
      },
      components: {
        title: "Componentes",
        appLibrary: "Biblioteca do App",
        projectComponents: "Componentes do Projeto",
        saveToProject: "Salvar no Projeto",
        defaultName: "Componente {{number}}",
        emptyAppLibrary: "Nenhum componente nativo ainda.",
        emptyProjectComponents: "Nenhum componente do projeto ainda.",
        placementHint: "Clique ou arraste um componente para o canvas para posicion\u00E1-lo. Segure Alt para sele\u00E7\u00E3o por conten\u00E7\u00E3o.",
        delete: "Excluir",
        exportToAppLibrary: "Baixar JSON",
        exportSuccess: "JSON do componente baixado: {{fileName}}",
        exportFailed: "N\u00E3o foi poss\u00EDvel baixar o JSON do componente.",
        exportFilePrompt: "Nome do arquivo JSON do componente",
        exportCategoryPrompt: "Categoria",
        exportHelp: "Os arquivos baixados podem ser adicionados a src/library/components e inclu\u00EDdos no pr\u00F3ximo build.",
        searchPlaceholder: "Buscar componentes",
        sourceApp: "App",
        sourceProject: "Projeto",
        uncategorized: "Sem categoria",
        noMatches: "Nenhum componente corresponde ao filtro atual."
      },
      layers: {
        title: "Camadas",
        show: "Mostrar",
        hide: "Ocultar",
        lock: "Travar",
        edit: "Editar",
        deleteShort: "Del"
      },
      potentials: {
        title: "Potenciais",
        renumber: "Renumerar",
        empty: "Nenhum potencial ainda.",
        unnamed: "Sem nome",
        noSize: "Sem bitola",
        sizeValue: "{{value}} mm\u00B2",
        prefix: "P{{number}}"
      },
      properties: {
        title: "Propriedades",
        empty: "Selecione um objeto para editar as propriedades.",
        activeLayer: "Camada ativa: {{name}}",
        delete: "Excluir",
        rotateMinus15: "Rotacionar -15 graus",
        rotatePlus15: "Rotacionar +15 graus",
        mirrorHorizontal: "Espelhar Horizontal",
        mirrorVertical: "Espelhar Vertical",
        alignLeft: "Alinhar \u00E0 Esquerda",
        alignCenterX: "Alinhar ao Centro X",
        alignRight: "Alinhar \u00E0 Direita",
        alignTop: "Alinhar ao Topo",
        alignCenterY: "Alinhar ao Centro Y",
        alignBottom: "Alinhar \u00E0 Base",
        moveX: "Mover X",
        moveY: "Mover Y",
        applyMove: "Aplicar Movimento",
        layer: "Camada",
        line: "Linha",
        lineWidth: "Espessura da linha",
        lineStyle: "Estilo da linha",
        continuous: "Cont\u00EDnua",
        dashed: "Tracejada",
        dotted: "Pontilhada",
        number: "N\u00FAmero",
        name: "Nome",
        diameterMm2: "Bitola (mm\u00B2)",
        x1: "X1",
        y1: "Y1",
        x2: "X2",
        y2: "Y2",
        cx: "CX",
        cy: "CY",
        r: "R",
        start: "In\u00EDcio",
        end: "Fim",
        x: "X",
        y: "Y",
        text: "Texto",
        size: "Tamanho",
        link: "Link",
        target: "Destino",
        pinX: "Pino X",
        pinY: "Pino Y",
        tag: "Tag",
        tagX: "Tag X",
        tagY: "Tag Y",
        tagSize: "Tamanho da tag",
        originX: "Origem X",
        originY: "Origem Y"
      },
      app: {
        pagesAriaLabel: "P\u00E1ginas",
        pageLabel: "P\u00E1gina {{number}}",
        layerLabel: "Camada {{number}}",
        deletePage: "Excluir p\u00E1gina",
        groupSelection: "Agrupar sele\u00E7\u00E3o",
        ungroup: "Desagrupar",
        moveToLayer: "Mover para camada",
        exportFilename: "cad-export.pdf",
        newText: "Texto",
        newPin: "Pino"
      }
    }
  }
} as const;
