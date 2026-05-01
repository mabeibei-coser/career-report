export interface BankQuestion {
  id: string;
  text: string;
  tag: "tradeoff" | "anxiety" | "comparison" | "expectation" | "resilience";
}

/**
 * 10 道职业心态题，覆盖一切阶段的求职者（应届/跳槽/转行/失业再就业等）
 * 口吻：像社保局/职业定位顾问老师面对面 1v1 聊天，自然口语，不堆术语
 */
export const INTERVIEW_QUESTION_BANK: BankQuestion[] = [
  {
    id: "q1",
    tag: "expectation",
    text: "假如你最后接的这份工作，薪资、平台或者岗位其实没你想得那么理想，你打算怎么去面对？",
  },
  {
    id: "q2",
    tag: "tradeoff",
    text: "你现在选工作，是更想要一个稳定的环境，还是想找个能让自己成长更快的地方？",
  },
  {
    id: "q3",
    tag: "tradeoff",
    text: "我给你举个例子：一边是大公司、薪资好但岗位偏边缘；另一边是小公司核心岗位、成长快但稳定性差一些。你会怎么选？",
  },
  {
    id: "q4",
    tag: "comparison",
    text: "你身边有没有那种让你又羡慕又有点压力的同龄人？他们的状态会不会影响你找工作的判断？",
  },
  {
    id: "q5",
    tag: "resilience",
    text: "如果你做了一段时间发现这份工作不合适，你会马上换，还是会先撑一阵再说？",
  },
  {
    id: "q6",
    tag: "expectation",
    text: "现在不少人会说，上班就是打工，别谈什么理想。你认同这种说法吗？",
  },
  {
    id: "q7",
    tag: "expectation",
    text: "你想象一下，你最舒服的工作状态会是怎样的？是想图个清闲，还是宁可累点，但能多学些东西？",
  },
  {
    id: "q8",
    tag: "anxiety",
    text: "找工作这段时间，让你最睡不着的事情是什么？是怕方向选错、薪资不够，还是怕被人比下去？",
  },
  {
    id: "q9",
    tag: "resilience",
    text: "万一接下来一两年行业不景气、岗位竞争特别激烈，你心里有没有想过自己的 Plan B？",
  },
  {
    id: "q10",
    tag: "expectation",
    text: "这份工作做下来，你最希望它带给你什么？是经济上的踏实感、能力上的积累、平台上的背书，还是说，把自己往哪儿走想清楚？",
  },
];

export function pickRandomQuestion(exclude?: string[]): BankQuestion {
  const pool = INTERVIEW_QUESTION_BANK.filter((q) => !exclude?.includes(q.id));
  const source = pool.length > 0 ? pool : INTERVIEW_QUESTION_BANK;
  return source[Math.floor(Math.random() * source.length)];
}
