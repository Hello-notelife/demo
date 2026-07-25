window.DATA = (function () {
  // 决策第一步：说出真正的困扰。
  // 这里只问真实困境本身 —— 不问童年、不问简历、不预设是创业问题。
  var PROMPTS = [
    {
      key: 'problem',
      level: '决策第一步',
      title: '说出真正的困扰。',
      question: '把此刻让你犹豫、焦虑、拿不准的真实困境，原原本本地告诉我。',
      placeholder: '例如：我工作了 5 年，最近在考虑要不要辞职做独立开发。但我担心获客不稳定，也分不清自己是真正想创业，还是只是想逃离现在的职场……',
      helper: '不用组织语言，也不用先想清楚。说不清楚本身就是信息。',
      suggestions: [
        '［职业/创业］我在考虑要不要辞职去……',
        '［关系/家庭］我不知道该不该结束/进入……',
        '［承诺/锁定］我在犹豫要不要买房/承担这笔长期负债……'
      ]
    },
    {
      key: 'facts',
      level: '决策第二步 · 可选',
      title: '有哪些已经确定的事？',
      question: '时间、钱、身体、合同、别人的态度——任何已经成立、不由你主观决定的事实。',
      placeholder: '例如：手里能撑 8 个月生活费；房贷每月 6 千；伴侣明确说不反对但希望先试半年；公司明年 3 月才发年终……',
      helper: '不确定的先别写。这里只放事实，猜测留到下一步由系统标出来。',
      suggestions: ['时间上我最晚要在…之前决定', '钱能撑…个月', '有一个我改变不了的限制是…']
    },
    {
      key: 'cares',
      level: '决策第三步 · 可选',
      title: '你真正在意什么？',
      question: '这个决定里，你最不想失去的是什么？还有谁的处境会被它改变？',
      placeholder: '例如：我不想再错过孩子的成长；也不想到 40 岁还没试过自己想做的事；但我不能让家里的现金流断掉……',
      helper: '价值冲突不是矛盾，是这个决定真正难的地方。',
      suggestions: ['我最不想失去的是…', '这件事还会影响到…', '我不愿意为它牺牲…']
    }
  ];

  // 安全路由（对应产品文档的 HIGH RISK 层）：
  // 这些领域不做推演，改为说明边界并转介专业角色。
  var SAFETY_RULES = [
    { words: ['自杀', '自残', '轻生', '想死', '活不下去', '不想活'], type: 'crisis' },
    { words: ['家暴', '被打', '殴打', '人身安全', '威胁我'], type: 'violence' },
    { words: ['确诊', '化疗', '肿瘤', '治疗方案', '吃药', '手术方案'], type: 'medical' },
    { words: ['判刑', '起诉', '仲裁', '离婚官司', '打官司'], type: 'legal' },
    { words: ['梭哈', '杠杆', '炒币', '贷款炒', '合约交易'], type: 'finance' }
  ];

  var SAFETY_MESSAGES = {
    crisis: '这件事比任何决策推演都重要。请立即联系身边可信任的人，或拨打心理援助热线 400-161-9995。你现在的安全是第一位的。',
    violence: '涉及人身安全的处境不进入推演。请联系当地公安机关（110）或全国妇联维权热线 12338，先确保你处在安全的地方。',
    medical: '医疗诊断与治疗方案不进入推演，也不会给出用药或治疗建议。请咨询有资质的医生。你可以把问题改写成一个自己能控制的生活或工作决定。',
    legal: '法律定性与诉讼策略不进入推演。请咨询执业律师。你可以把问题改写成一个不依赖判决结果的决定。',
    finance: '具体投资收益不进入推演，也不会给出投资建议。你可以把问题改写成关于风险承受能力和退出条件的决定。'
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
    checkSafety: checkSafety
  };
})();
