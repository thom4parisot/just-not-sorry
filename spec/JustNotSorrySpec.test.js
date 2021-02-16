import { h } from 'preact';
import JustNotSorry from '../src/components/JustNotSorry.js';
import { configure, mount } from 'enzyme';
import Adapter from 'enzyme-adapter-preact-pure';

configure({ adapter: new Adapter() });

document.createRange = jest.fn(() => ({
  setStart: jest.fn(),
  setEnd: jest.fn(),
  commonAncestorContainer: {
    nodeName: 'BODY',
    ownerDocument: document,
  },
  startContainer: 'test',
  getClientRects: jest.fn(() => [{}]),
}));

const buildWarning = (pattern, message) => ({
  regex: new RegExp(pattern, 'ig'),
  message,
});

describe('JustNotSorry', () => {
  jest.useFakeTimers();
  let wrapper, instance, mutationObserverMock;

  beforeEach(() => {
    mutationObserverMock = jest.fn(function MutationObserver(callback) {
      this.observe = jest.fn();
      this.disconnect = jest.fn();
      this.trigger = (mockedMutationList) => {
        callback(mockedMutationList, this);
      };
    });
    global.MutationObserver = mutationObserverMock;

    wrapper = mount(<JustNotSorry />);
    instance = wrapper.instance();
  });

  afterEach(() => {
    wrapper.unmount();
  });

  const generateEditableDiv = (props, innerHtml) => {
    const divNode = mount(
      <div {...props} contentEditable={'true'}>
        {innerHtml ? innerHtml : ''}
      </div>
    );
    return divNode;
  };

  describe('documentObserver', () => {
    it('listens for structural changes to the content editable div in document body', () => {
      const observerInstances = mutationObserverMock.mock.instances;
      expect(observerInstances.length).toBe(1);
      expect(observerInstances[0].observe).toHaveBeenCalledWith(document.body, {
        childList: true,
        subtree: true,
      });
    });
  });

  describe('#handleSearch', () => {
    describe('on focus', () => {
      it('checks for warnings', () => {
        const handleSearch = jest.spyOn(instance, 'handleSearch');

        const node = generateEditableDiv(
          {
            id: 'div-focus',
          },
          'just not sorry'
        );
        const domNode = node.getDOMNode();
        const mockedMutation = { type: 'childList', target: domNode };
        const documentObserver = mutationObserverMock.mock.instances[0];
        documentObserver.trigger([mockedMutation]);

        node.simulate('focus');
        jest.runOnlyPendingTimers();

        expect(handleSearch).toHaveBeenCalledTimes(1);
        expect(wrapper.state('warnings').length).toEqual(2);
      });

      it('does nothing when given an empty string', () => {
        const handleSearch = jest.spyOn(instance, 'handleSearch');

        const node = generateEditableDiv({ id: 'some-id' });

        const domNode = node.getDOMNode();
        const mockedMutation = { type: 'childList', target: domNode };
        const documentObserver = mutationObserverMock.mock.instances[0];
        documentObserver.trigger([mockedMutation]);

        node.simulate('focus');
        jest.runOnlyPendingTimers();

        expect(handleSearch).toHaveBeenCalledTimes(1);
        expect(wrapper.state('warnings').length).toEqual(0);
      });
    });

    describe('on input', () => {
      it('updates warnings each time input is triggered', () => {
        const handleSearch = jest.spyOn(instance, 'handleSearch');
        const node = generateEditableDiv({ id: 'test' }, 'just not sorry');

        const domNode = node.getDOMNode();
        const mockedMutation = { type: 'childList', target: domNode };
        const documentObserver = mutationObserverMock.mock.instances[0];
        documentObserver.trigger([mockedMutation]);

        node.simulate('input');
        jest.runOnlyPendingTimers();
        expect(handleSearch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('#resetState', () => {
    describe('on blur', () => {
      it('removes any existing warnings', () => {
        const spy = jest.spyOn(instance, 'resetState');

        const node = generateEditableDiv(
          {
            id: 'div-focus',
          },
          'just not sorry'
        );

        const domNode = node.getDOMNode();
        const mockedMutation = { type: 'childList', target: domNode };
        const documentObserver = mutationObserverMock.mock.instances[0];
        documentObserver.trigger([mockedMutation]);

        node.simulate('blur');

        expect(spy).toHaveBeenCalledTimes(1);
        expect(wrapper.state('warnings').length).toEqual(0);
      });
    });
  });

  describe('#search', () => {
    it('adds a valid range for a punctuation keyword', () => {
      const node = generateEditableDiv({ id: 'meaningless-id' }, 'test!!!');
      const domNode = node.getDOMNode();
      const ranges = instance.search(
        domNode,
        buildWarning('\\b!{3,}\\B', 'warning message')
      );
      expect(ranges.length).toEqual(1);
      expect(ranges[0].rangeToHighlight).toBeTruthy();
      expect(ranges[0]).toEqual(
        expect.objectContaining({
          message: 'warning message',
          parentNode: domNode.parentNode,
        })
      );
    });

    it('adds a warning for a single keyword', () => {
      const node = generateEditableDiv(
        { id: 'meaningless-id' },
        'test just test'
      );

      const domNode = node.getDOMNode();
      const ranges = instance.search(
        domNode,
        buildWarning('just', 'warning message')
      );

      expect(ranges.length).toEqual(1);
      expect(ranges[0].rangeToHighlight).toBeTruthy();
      expect(ranges[0]).toEqual(
        expect.objectContaining({
          message: 'warning message',
          parentNode: domNode.parentNode,
        })
      );
    });

    it('does not add warnings for partial matches', () => {
      const node = generateEditableDiv({ id: 'div-id' }, 'test justify test');

      const domNode = node.getDOMNode();
      const ranges = instance.search(
        domNode,
        buildWarning('\\b(just)\\b', 'warning message')
      );
      expect(ranges.length).toEqual(0);
      expect(ranges).toEqual([]);
    });

    it('matches case insensitive', () => {
      const node = generateEditableDiv({ id: 'div-case' }, 'jUsT kidding');

      const domNode = node.getDOMNode();
      const ranges = instance.search(
        domNode,
        buildWarning('just', 'warning message')
      );

      expect(ranges.length).toEqual(1);
      expect(ranges[0].rangeToHighlight).toBeTruthy();
      expect(ranges[0]).toEqual(
        expect.objectContaining({
          message: 'warning message',
          parentNode: domNode.parentNode,
        })
      );
    });

    it('catches keywords with punctuation', () => {
      const node = generateEditableDiv({ id: 'div-punctuation' }, 'just. test');

      const domNode = node.getDOMNode();
      const ranges = instance.search(
        domNode,
        buildWarning('just', 'warning message')
      );
      expect(ranges.length).toEqual(1);
      expect(ranges[0].rangeToHighlight).toBeTruthy();
      expect(ranges[0]).toEqual(
        expect.objectContaining({
          message: 'warning message',
          parentNode: domNode.parentNode,
        })
      );
    });

    it('matches phrases', () => {
      const node = generateEditableDiv(
        { id: 'div-phrase' },
        'my cat is so sorry because of you'
      );

      const domNode = node.getDOMNode();
      const ranges = instance.search(
        domNode,
        buildWarning('so sorry', 'warning message')
      );
      expect(ranges.length).toEqual(1);
      expect(ranges[0].rangeToHighlight).toBeTruthy();
      expect(ranges[0]).toEqual(
        expect.objectContaining({
          message: 'warning message',
          parentNode: domNode.parentNode,
        })
      );
    });

    it('does not add warnings for tooltip matches', () => {
      document.createRange = jest.fn(() => ({
        setStart: jest.fn(),
        setEnd: jest.fn(),
        commonAncestorContainer: {
          nodeName: 'BODY',
          ownerDocument: document,
        },
        startContainer:
          "The word 'very' does not communicate enough information. Find a stronger, more meaningful adverb, or omit it completely. --Andrea Ayres",
        getClientRects: jest.fn(() => [{}]),
      }));

      const node = generateEditableDiv({ id: 'div-3' }, 'test justify test');
      const domNode = node.getDOMNode();
      const mockedMutation = { type: 'childList', target: domNode };
      const documentObserver = mutationObserverMock.mock.instances[0];
      documentObserver.trigger([mockedMutation]);

      node.simulate('focus');
      jest.runOnlyPendingTimers();

      expect(wrapper.state('warnings').length).toEqual(0);
      expect(wrapper.state('warnings')).toEqual([]);
    });
  });

  describe('#searchEmail', () => {
    it('adds warnings to all keywords', () => {
      const node = generateEditableDiv(
        { id: 'div-keywords' },
        'I am just so sorry. Yes, just.'
      );

      const domNode = node.getDOMNode();
      instance.searchEmail(domNode);
      expect(wrapper.state('warnings').length).toEqual(3);
    });
  });
});
