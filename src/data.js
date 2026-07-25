window.DATA = (function () {
  var PROMPTS = [
    {
      key: 'memory',
      level: 'LEVEL 01 · MEMORY MAP',
      title: '先从你说起。',
      question: '从小学到现在，哪些经历最影响你做事的方式？像讲故事一样说就好。',
      placeholder: '例如：小学时我喜欢拆东西；大学做过社团和两个小产品；毕业后在 SaaS 公司做了 3 年增长……',
      helper: '不用写简历。说你真正做过、失败过和坚持过的事。',
      suggestions: ['我从小最常做的是…', '我第一次把东西卖出去是在…', '工作后我发现自己擅长…']
    },
    {
      key: 'venture',
      level: 'LEVEL 02 · THE VENTURE',
      title: '现在，说说这个项目。',
      question: '它叫什么、为谁解决什么问题、准备怎么赚钱？',
      placeholder: '例如：项目叫「回声」，帮 10—50 人的小团队把客户访谈自动变成产品决策，按月订阅收费……',
      helper: '一句不完整也没关系。系统会把未知留成未知，不替你编答案。',
      suggestions: ['我想卖给…', '用户现在用…凑合解决', '我准备通过…收费']
    },
    {
      key: 'reality',
      level: 'LEVEL 03 · REALITY CHECK',
      title: '最后，说说你手里的牌。',
      question: '现在做到哪一步？有多少钱、几个人、多少真实用户？每月大概花多少？',
      placeholder: '例如：已经有可用原型，2 个人兼职，手里 8 万元，每月花 1.5 万，有 12 个试用用户但还没人付费……',
      helper: '大概数字就够。它们会决定地图上坑有多深。',
      suggestions: ['目前只有一个想法…', '已经有原型和…位试用者', '现金大约…万，每月花…万']
    }
  ];

  var PRESETS = [
    {
      id: 'echo',
      name: '回声',
      label: 'AI SaaS · 原型期',
      color: 'cyan',
      answers: {
        memory: '小学时我喜欢拆收音机，大学负责过社团招新，第一次发现自己擅长把复杂的东西讲清楚。毕业后在一家 SaaS 公司做了 3 年增长，做过 40 多次客户访谈，也经历过一个没人用的内部项目。',
        venture: '项目叫「回声」，帮 10 到 50 人的产品团队把客户访谈自动整理成产品决策。目标客户是没有专职研究员的 SaaS 团队，准备按月订阅收费。',
        reality: '现在有一个能跑的原型，2 个人兼职，手里有 8 万元，每月大约花 1.5 万。找了 12 个团队试用，4 个持续使用，但还没有人正式付费。'
      }
    },
    {
      id: 'night-kitchen',
      name: '夜航厨房',
      label: '本地消费 · 验证期',
      color: 'amber',
      answers: {
        memory: '我从小跟着家里做餐饮，高中开始帮忙进货。大学学设计，毕业后做了 5 年品牌工作。我很懂视觉和用户体验，但没有独立管过门店现金流。',
        venture: '项目叫「夜航厨房」，给加班到很晚的写字楼员工提供健康夜宵，通过小程序预订和固定路线配送赚钱。',
        reality: '已经在一个园区试了 3 周，我和一个厨师两个人。投入 12 万，每月固定成本约 3 万。累计 160 个订单，复购 18%，大部分订单来自一次企业团购。'
      }
    }
  ];

  var SAFETY_RULES = [
    { words: ['自杀', '自残', '轻生', '想死', '活不下去'], type: 'safety' },
    { words: ['确诊', '化疗', '肿瘤', '治疗方案', '吃药'], type: 'medical' },
    { words: ['判刑', '起诉', '仲裁', '离婚官司'], type: 'legal' },
    { words: ['梭哈', '杠杆', '炒币', '贷款炒', '合约交易'], type: 'finance' }
  ];

  var SAFETY_MESSAGES = {
    safety: '这类问题不适合做未来游戏化推演。请先联系身边可信任的人或当地紧急服务，优先确保你现在的安全。',
    medical: '医疗结果不进入推演。你可以把问题改写成一个自己能控制的商业或行动决定。',
    legal: '法律纠纷结果不进入推演。请咨询有资质的专业人士。',
    finance: '高风险投资收益不进入推演，也不会输出投资建议。'
  };

  function checkSafety(text) {
    var source = String(text || '');
    for (var i = 0; i < SAFETY_RULES.length; i++) {
      for (var j = 0; j < SAFETY_RULES[i].words.length; j++) {
        if (source.indexOf(SAFETY_RULES[i].words[j]) >= 0) {
          return {
            allowed: false,
            type: SAFETY_RULES[i].type,
            message: SAFETY_MESSAGES[SAFETY_RULES[i].type]
          };
        }
      }
    }
    return { allowed: true };
  }

  return {
    PROMPTS: PROMPTS,
    PRESETS: PRESETS,
    checkSafety: checkSafety
  };
})();
