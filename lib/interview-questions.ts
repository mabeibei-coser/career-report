export interface BankQuestion {
  id: string;
  text: string;
  tag: "tradeoff" | "anxiety" | "comparison" | "expectation" | "resilience";
}

/**
 * 10 道职业心态题，覆盖一切阶段的求职者（应届/跳槽/转行/失业再就业等）
 * 口吻：像职业定位顾问老师面对面 1v1 聊天，自然口语，不堆术语
 * 设计原则：开放式提问，引导讲故事 / 说感受，不预设选项
 */
export const INTERVIEW_QUESTION_BANK: BankQuestion[] = [
  {
    id: "q1",
    tag: "expectation",
    text: "你选择现在这个求职方向，最打动你的是什么？是看好它的前景、觉得自己擅长、还是有别的原因？聊聊你的想法。",
  },
  {
    id: "q2",
    tag: "tradeoff",
    text: "找工作的时候，薪资、发展空间、工作节奏、离家远近……这些里面，你最看重哪个？为什么？",
  },
  {
    id: "q3",
    tag: "tradeoff",
    text: "假设你同时拿到两个 offer，一个各方面都还行但没太大惊喜，另一个有你特别想要的东西但也有明显短板——你会怎么选？",
  },
  {
    id: "q4",
    tag: "comparison",
    text: "你有没有看到过别人的求职经历——不管是学长学姐、同学还是网上的分享——让你对自己的求职有了一些新的想法或者触动？",
  },
  {
    id: "q5",
    tag: "resilience",
    text: "求职过程中难免碰到不顺利，比如被拒、等不到回复、或者突然对自己产生怀疑。遇到这种情况你一般怎么调整？",
  },
  {
    id: "q6",
    tag: "expectation",
    text: "你觉得第一份工作最重要的是什么——是多挣钱、多学东西、认识厉害的人，还是先搞清楚自己适合做什么？",
  },
  {
    id: "q7",
    tag: "expectation",
    text: "回想一下你过去的经历——学习、实习、兼职、参加比赛或者自己做的事都算——哪件事让你最有成就感？是什么让你印象这么深？",
  },
  {
    id: "q8",
    tag: "anxiety",
    text: "对于即将开始的职业生涯，你心里最大的顾虑是什么？比如怕选错方向、担心竞争激烈、还是对自己的能力不太有把握？",
  },
  {
    id: "q9",
    tag: "resilience",
    text: "如果入职后发现这份工作跟你预期的不太一样——可能是工作内容、团队氛围或者成长速度——你会怎么应对？",
  },
  {
    id: "q10",
    tag: "expectation",
    text: "往后看三年，你希望自己是什么状态？不用很具体，说说你理想中的工作和生活大概是什么样的。",
  },
];

/** 模块级游标：进程存活期间顺序滚动，重启后从头来 */
let _cursor = 0;

/**
 * 顺序取下一道题（非随机）。
 * 每次调用游标向后推一位；exclude 不为空时自动跳过已用题，游标仍正确推进。
 */
export function pickNextQuestion(exclude?: string[]): BankQuestion {
  const bank = INTERVIEW_QUESTION_BANK;
  const n = bank.length;

  for (let i = 0; i < n; i++) {
    const q = bank[(_cursor + i) % n];
    if (!exclude?.includes(q.id)) {
      _cursor = (_cursor + i + 1) % n;
      return q;
    }
  }

  // 全部被排除（正常不会走到这里）：返回当前游标并推进
  const fallback = bank[_cursor];
  _cursor = (_cursor + 1) % n;
  return fallback;
}

/** @deprecated 使用 pickNextQuestion 代替 */
export function pickRandomQuestion(exclude?: string[]): BankQuestion {
  return pickNextQuestion(exclude);
}
