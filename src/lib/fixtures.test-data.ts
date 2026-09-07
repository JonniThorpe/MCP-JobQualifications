/**
 * Fixtures calcados de los archivos reales, incluidas sus trampas:
 * la seccion '## Reglas' con vinietas que NO son huecos, la watchlist con
 * contador 0, las notas entre parentesis y las fuentes con comas dentro.
 */

export const SKILLS_MD = `# Perfil de skills: lo que tengo

Solo skills que poseo, a nivel **[solido]** o **[parcial]**.

---

## Lenguajes de programacion
- [solido] Java (Java 8, un ano en Indra mas el backend del proyecto WhatsApp)
- [solido] Python (proyectos de IA, scripting, fine-tuning)
- [parcial] JavaScript y TypeScript

## Backend
- [solido] Spring y Spring Boot
- [solido] Testing: JUnit5, Mockito, cobertura de codigo
- [parcial] JBoss, Maven

## Infraestructura, DevOps y despliegue
- [solido] Docker
- [parcial] RunPod y GPU cloud (usado para fine-tuning, no en produccion)
`;

export const RADAR_MD = `# Radar de huecos

Skills que las ofertas piden y que aun no tengo.

## Reglas
- Cuando una oferta pide algo que ya esta aqui, sube su contador en uno.
- Anade la fuente y tambien un contador a la seccion de fuentes registradas.
- Aqui nunca hay skills que ya tengo.

## Confirmados por ofertas
- [contador: 1] Sistemas distribuidos e infraestructura a gran escala (Infraestructura). Fuentes: Google SWE II Threat Intelligence, Malaga.
- [contador: 3] Diseno de sistemas a gran escala (Fundamentos). Fuentes: Google SWE II, Malaga
- [contador: 1] Accesibilidad, a11y (Frontend). Fuentes: Google SWE II, Malaga.

## Watchlist sin confirmar por ofertas
Hipotesis de valor que aun no ha pedido ninguna oferta.
- [contador: 0] Kubernetes (Infraestructura).
- [contador: 0] Graph RAG (Ingenieria de LLM).

## Fuentes registradas
`;

/**
 * Base del CV calcada de perfil/cv-data.json. Se duplica aqui a proposito: los
 * tests no deben depender de la boveda del usuario, y ademas asi el test de
 * calibracion mide siempre el mismo contenido aunque Jonni anada proyectos.
 */
export const CV_BASE = {
  identity: {
    name: "Jonatan Thorpe Plaza",
    headline: "Full-Stack Engineer ·<br>Applied Machine Learning",
    location: "Alhaurin el Grande, Malaga, Spain",
    links: [
      { label: "+34 622 53 78 01", href: "tel:+34622537801" },
      { label: "jonnithorpe7@gmail.com", href: "mailto:jonnithorpe7@gmail.com" },
      { label: "jonatanthorpe.dev", href: "https://jonatanthorpe.dev" },
      { label: "linkedin.com/in/jonatan-thorpe-plaza", href: "https://www.linkedin.com/in/x" },
      { label: "github.com/JonniThorpe", href: "https://github.com/JonniThorpe" },
      { label: "github.com/jtp703", href: "https://github.com/jtp703" }
    ]
  },
  summary:
    "Computer Engineer specialised in Software Engineering, with a backend foundation (Java, Spring, SQL) and experience building web products end to end. I apply machine learning to real business problems: fine-tuning language and vision models and integrating LLMs.",
  stack: [
    { id: "languages", label: "Languages", tags: ["Java", "Python", "JS / TS", "C#", "C++", "SQL", "HTML/CSS"] },
    { id: "frameworks", label: "Frameworks", tags: ["Spring", "React", "Next.js", "Angular", "ASP.NET", "GWT", "Mockito"] },
    { id: "ai", label: "AI / ML", tags: ["LoRA", "PEFT", "Unsloth", "DeepSeek", "Gemini", "Gemma", "OCR pipelines", "Whisper", "MCP"] },
    { id: "databases", label: "Databases", tags: ["PostgreSQL", "MySQL", "Oracle", "Supabase"] },
    { id: "devops", label: "Tools & DevOps", tags: ["Git", "Docker", "CI/CD", "GitHub Actions", "Vercel", "RunPod", "JBoss", "Maven", "nginx"] },
    { id: "methodologies", label: "Methodologies", tags: ["Scrum / Agile", "TDD", "Unit testing", "SOLID", "Design patterns", "ISO/IEC 25010", "Quality gates"] }
  ],
  experience: [
    {
      id: "indra",
      role: "Junior Developer",
      org: "Indra Produccion Software",
      dates: "Jan 2021 - Oct 2021",
      bullets: [
        { id: "indra-backend", text: "Backend development and maintenance in Java 8 with Spring and Oracle." },
        { id: "indra-tests", text: "Implementation of unit tests (Mockito) and front-end development with GWT." },
        { id: "indra-coverage", text: "Raised unit test coverage from 70% to over 95% on the modules I owned." },
        { id: "indra-db", text: "Database management, SQL queries and deployment on JBoss server." },
        { id: "indra-galileo", text: "Contributor to Galileo, the European GNSS programme." },
        { id: "indra-scrum", text: "Work under Scrum methodology and use of Git." }
      ]
    },
    {
      id: "allnatura",
      role: "Web Application Developer",
      org: "All Natura S.L.",
      dates: "Oct 2020 - Jan 2021",
      bullets: [
        { id: "allnatura-web", text: "Web page design and layout." },
        { id: "allnatura-odoo", text: "Customisation of the Odoo CRM." }
      ]
    },
    {
      id: "stargroup",
      role: "Developer Intern",
      org: "Star-Group",
      dates: "Apr 2020 - Jun 2020",
      bullets: [
        { id: "stargroup-app", text: "Individual development of a web application for an English academy (ASP.NET)." },
        { id: "stargroup-scrum", text: "Work under agile Scrum methodology." }
      ]
    }
  ],
  projects: [
    {
      id: "scannet",
      title: "Scannet - Final Degree Project (TFG)",
      stack: "React · Vite · Supabase · DeepSeek-OCR2 (LoRA) · RunPod · Vercel",
      lines: [
        { label: "Need", text: "digitalise data from purchase receipts, removing manual data entry." },
        { label: "Idea", text: "combine OCR with a fine-tuned vision-language model to extract structured data automatically." },
        { label: "Build", text: "production pipeline (OCR + DeepSeek API + Supabase) extracting structured JSON (merchant, VAT ID, date, items, totals), self-hosted and live; parallel academic track fine-tuning DeepSeek-OCR2 with LoRA/PEFT (Unsloth) on RunPod GPUs, with a real-receipt dataset augmented ~10x." }
      ]
    },
    {
      id: "whatsapp",
      title: "AI Order Automation",
      stack: "Spring Boot · React · MySQL · WhatsApp API (Meta) · DeepSeek · JWT · Docker",
      lines: [
        { label: "Need", text: "orders arrived as informal WhatsApp messages and required manual transcription." },
        { label: "Idea", text: "use an LLM (DeepSeek) to interpret natural language and generate structured orders automatically." },
        { label: "Build", text: "Meta Cloud API integration in coexistence mode with custom Spring Boot webhooks (capturing both client and business-sent messages), plus Whisper audio transcription; currently onboarding first pilot clients." }
      ]
    },
    {
      id: "portfolio",
      title: "Self-hosted Portfolio - jonatanthorpe.dev",
      stack: "React 19 · Vite · nginx · Hetzner VPS · TLS/certbot · GitHub Actions CI/CD · IaC",
      lines: [
        { label: "Need", text: "build DevOps skills hands-on in a real project running in production." },
        { label: "Idea", text: "self-manage the full cycle (server, TLS, CI/CD, hardening) and set it up to deploy future web apps." },
        { label: "Build", text: "Ubuntu VPS on Hetzner with nginx, Let's Encrypt TLS and automated deployments via GitHub Actions." }
      ]
    },
    {
      id: "jobmcp",
      title: "Job Search MCP Server",
      stack: "TypeScript · Model Context Protocol SDK · Node · stdio · node:test",
      lines: [
        { label: "Need", text: "keep an evolving skills profile and job-offer pipeline usable by an LLM without copy-pasting context by hand." },
        { label: "Idea", text: "expose a personal Markdown vault to any MCP client through tools, resources and prompts." },
        { label: "Build", text: "MCP server exposing typed tools with Zod-validated schemas over a Markdown vault, with pure-function core, unit tests and atomic writes." }
      ]
    },
    {
      id: "store",
      title: "Online Store",
      stack: "Spring Boot · JSP · MySQL · Selenium (E2E)",
      lines: [
        { label: "Need", text: "give a local business its own online sales channel." },
        { label: "Idea", text: "build a full-stack e-commerce solution for a small local business." }
      ]
    },
    {
      id: "academy",
      title: "Web App for an English Academy",
      org: "Star-Group internship",
      stack: "C# · ASP.NET MVC · SQL Server",
      lines: [
        { label: "Need", text: "a local English academy needed to digitalise the management of its activity." },
        { label: "Idea", text: "address the real business needs of a local company with a tailor-made web application." }
      ]
    }
  ],
  education: [
    { id: "ual", role: "BSc in Computer Engineering", org: "University of Almeria", dates: "2021 - 2025", note: "Software Engineering specialisation" },
    { id: "dam", role: "Higher Technician in Multiplatform Application Development (DAM)", org: "IES Los Montecillos", dates: "2018 - 2020" },
    { id: "smr", role: "Technician in Microcomputer Systems & Networks (SMR)", org: "IES Gerald Brenan", dates: "2016 - 2018" }
  ],
  languages: [
    { name: "Spanish", level: "Native" },
    { name: "English", level: "Native" }
  ]
};

/**
 * La seleccion que reproduce exactamente el CV que Jonni diseno a mano y que
 * cabe justo en una pagina. Es la linea base del modelo de altura.
 */
export const CV_ORIGINAL = {
  offerId: "calibracion",
  stack: [
    { id: "languages" },
    { id: "frameworks" },
    { id: "ai", tags: ["LoRA", "PEFT", "Unsloth", "DeepSeek", "Gemini", "Gemma", "OCR pipelines"] },
    { id: "databases" },
    { id: "devops", tags: ["Git", "Docker", "CI/CD", "Vercel", "RunPod", "JBoss", "Maven", "nginx"] },
    { id: "methodologies", tags: ["Scrum / Agile", "TDD", "Unit testing"] }
  ],
  experience: [{ id: "indra" }, { id: "allnatura" }, { id: "stargroup" }],
  projects: ["scannet", "whatsapp", "portfolio", "store", "academy"],
  education: ["ual", "dam", "smr"]
};
