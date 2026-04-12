// ========== 简历解析类型 ==========

export interface ResumeData {
  rawText: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'doc';
  extractedFields: Partial<JobFormData>;
  extraInfo: ResumeExtraInfo;
}

export interface ResumeExtraInfo {
  schoolName?: string;
  skills?: string[];
  workHistory?: string;
}

export interface ResumeSuggestions {
  items: {
    title: string;
    problem: string;
    suggestion: string;
  }[];
}

// ========== 表单输入类型 ==========

export interface JobFormData {
  positionName: string;
  industry: string;
  companyType: string;
  cityLevel: string;
  jobLevel: string;
  workYears: string;
}

// ========== AI 访谈类型 ==========

export interface InterviewMessage {
  role: "ai" | "user";
  content: string;
}

export interface InterviewState {
  messages: InterviewMessage[];
  currentQuestion: number;
  totalQuestions: number;
  isComplete: boolean;
}

// ========== 报告类型 ==========

export interface ReportData {
  meta: ReportMeta;
  summary: string;
  jobOverview: JobOverview;
  industryAnalysis: IndustryAnalysis;
  competencyProfile: CompetencyProfile;
  developmentPath: DevelopmentPath;
  personalizedAdvice: PersonalizedAdvice;
  supplementary: SupplementaryInfo;
  resumeSuggestions?: ResumeSuggestions;
}

export interface ReportMeta {
  generatedAt: string;
  formData: JobFormData;
  interviewSummary: string;
}

export interface JobOverview {
  positioning: string;
  responsibilities: {
    name: string;
    description: string;
    weight: number;
  }[];
  roleType: string;
  levelRequirements: string;
}

export interface IndustryAnalysis {
  trend: string;
  demandChange: string;
  competition: string;
  insights: {
    title: string;
    content: string;
  }[];
}

export interface CompetencyProfile {
  dimensions: {
    name: string;
    score: number;
    description: string;
    isCore: boolean;
  }[];
  highPerformerTraits: string[];
}

export interface DevelopmentPath {
  currentStage: string;
  upwardPaths: {
    title: string;
    description: string;
    requiredSkills: string[];
  }[];
  lateralPaths: {
    title: string;
    description: string;
  }[];
  shortTermAdvice: string[];
  midTermAdvice: string[];
}

export interface PersonalizedAdvice {
  items: {
    title: string;
    content: string;
  }[];
}

export interface SupplementaryInfo {
  benchmarkRoles: string[];
  salaryRange: {
    low: number;
    median: number;
    high: number;
    unit: string;
  };
  sources: string[];
  disclaimer: string;
}
