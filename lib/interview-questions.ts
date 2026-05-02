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
    text: "你是怎么确定自己想做这个方向的？有没有某个具体的时刻或者经历，让你觉得'就是这个'？",
  },
  {
    id: "q2",
    tag: "tradeoff",
    text: "在找工作这件事上，你给自己划了哪些绝对不能妥协的底线？",
  },
  {
    id: "q3",
    tag: "tradeoff",
    text: "如果朋友来问你怎么判断一份工作值不值得去，你会怎么跟他说？",
  },
  {
    id: "q4",
    tag: "comparison",
    text: "你身边有没有谁的职业路径让你印象很深——不管好坏？他们的经历对你有没有影响？",
  },
  {
    id: "q5",
    tag: "resilience",
    text: "你有没有经历过一件事，一开始很难坚持，但后来又想清楚撑过去了？当时是什么让你转变的？",
  },
  {
    id: "q6",
    tag: "expectation",
    text: "工作对你来说意味着什么？可以随便聊，不用给标准答案。",
  },
  {
    id: "q7",
    tag: "expectation",
    text: "你能回忆一下，哪段时间做某件事特别有劲儿、停不下来？那是什么？",
  },
  {
    id: "q8",
    tag: "anxiety",
    text: "找工作这段时间，你有没有哪个瞬间特别迷茫或者不确定？当时是什么感觉？",
  },
  {
    id: "q9",
    tag: "resilience",
    text: "如果接下来找工作不太顺，你一般怎么让自己缓过来？有没有你自己摸索出来的方法？",
  },
  {
    id: "q10",
    tag: "expectation",
    text: "你觉得自己在找工作这件事上，最大的优势是什么？最大的不确定又是什么？",
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
